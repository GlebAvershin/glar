/**
 * OurApp — маскер ПДн (ТЗ-04 §5).
 *
 * PiiVault — in-memory маппинг плейсхолдер → реальное значение в рамках сессии.
 * НЕ персистится на диск, НЕ уходит в сеть. Очищается при закрытии сессии.
 *
 * Плейсхолдеры — `__PII_FIO_1__` и т.п. Латиница + подчёркивания → устойчиво
 * к токенизации модели (пробелов нет, спец-символов нет, токенайзер вряд ли
 * порвёт). См. ТЗ-04 §10.
 */
import { detectAll } from "./detectors"
import type { MaskOptions, MaskResult, MaskStats, PiiMatch, PiiType } from "./types"
import { LABEL, MODE_TYPES } from "./types"
import { findProtectedRanges, isInProtectedRange, type ProtectedRange } from "./whitelist"

/**
 * Нормализация значения для консистентности (одна сущность = один плейсхолдер).
 *  - паспорт: все цифры подряд
 *  - ИНН/СНИЛС/ОГРН/счёт: только цифры
 *  - карта: только цифры
 *  - email: lowercase
 *  - телефон: только цифры, с ведущей 7
 *  - ФИО/адрес: trim + collapse spaces, регистр сохраняем (но ищем без учёта регистра)
 */
export function normalizeValue(type: PiiType, value: string): string {
  switch (type) {
    case "passport":
    case "inn_person":
    case "inn_org":
    case "snils":
    case "ogrn":
    case "bank_account":
    case "card":
      return value.replace(/\D/g, "")
    case "phone": {
      const d = value.replace(/\D/g, "")
      return d.startsWith("8") ? "7" + d.slice(1) : d
    }
    case "email":
      return value.toLowerCase()
    case "fio":
    case "address":
      return value.trim().replace(/\s+/g, " ").toLowerCase()
    case "birthdate":
      return value.replace(/\D/g, "")
  }
}

export class PiiVault {
  private map = new Map<string, string>() // placeholder → original value
  private reverse = new Map<string, string>() // normKey → placeholder
  private counters = new Map<PiiType, number>()

  /** Получить (или создать) плейсхолдер для значения. */
  placeholderFor(type: PiiType, value: string): string {
    const norm = `${type}:${normalizeValue(type, value)}`
    const existing = this.reverse.get(norm)
    if (existing) return existing
    const n = (this.counters.get(type) ?? 0) + 1
    this.counters.set(type, n)
    const ph = `__PII_${LABEL[type]}_${n}__`
    this.map.set(ph, value)
    this.reverse.set(norm, ph)
    return ph
  }

  /** Размер словаря. */
  get size(): number {
    return this.map.size
  }

  /** Очистить (при закрытии сессии). */
  clear() {
    this.map.clear()
    this.reverse.clear()
    this.counters.clear()
  }

  /**
   * Демаскирование: заменить все плейсхолдеры обратно на реальные значения.
   * Длинные плейсхолдеры заменяются раньше коротких — на случай вложенности.
   */
  unmask(text: string): string {
    if (this.map.size === 0) return text
    let out = text
    const phs = [...this.map.keys()].sort((a, b) => b.length - a.length)
    for (const ph of phs) {
      out = out.split(ph).join(this.map.get(ph)!)
    }
    return out
  }
}

/**
 * Разрешить пересечения матчей: оставить «лучший» вариант, остальные отбросить.
 * Стратегия: длинный матч с высокой уверенностью побеждает короткий.
 */
function resolveOverlaps(matches: PiiMatch[]): PiiMatch[] {
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    if (b.end !== a.end) return b.end - a.end // длиннее — раньше
    return b.confidence - a.confidence
  })
  const out: PiiMatch[] = []
  for (const m of sorted) {
    const conflict = out.find((x) => x.start < m.end && x.end > m.start)
    if (!conflict) {
      out.push(m)
      continue
    }
    // Конфликт: m лучше, если длиннее или с большей confidence.
    const mLen = m.end - m.start
    const cLen = conflict.end - conflict.start
    if (mLen > cLen || (mLen === cLen && m.confidence > conflict.confidence)) {
      const idx = out.indexOf(conflict)
      out.splice(idx, 1, m)
    }
  }
  return out
}

function emptyStats(): MaskStats {
  return {
    fio: 0,
    passport: 0,
    inn_person: 0,
    inn_org: 0,
    snils: 0,
    ogrn: 0,
    bank_account: 0,
    card: 0,
    phone: 0,
    email: 0,
    address: 0,
    birthdate: 0,
  }
}

/**
 * Замаскировать текст. Записывает всё в переданный vault — это позволяет
 * консистентно маскировать несколько частей одного запроса (текст + извлечённые
 * документы) с единым словарём подстановок.
 */
export function maskText(
  text: string,
  vault: PiiVault,
  options: MaskOptions,
): MaskResult {
  if (options.mode === "off" || !text) {
    return { maskedText: text, stats: emptyStats(), matches: [] }
  }

  const allowedTypes = MODE_TYPES[options.mode]
  const protectedRanges: ProtectedRange[] = findProtectedRanges(text)

  // Запускаем детекторы и фильтруем по режиму + whitelist.
  const raw = detectAll(text).filter((m) => {
    if (!allowedTypes.has(m.type)) return false
    if (isInProtectedRange(m.start, m.end, protectedRanges)) return false
    return true
  })

  const resolved = resolveOverlaps(raw)
  const stats = emptyStats()

  // Применяем замены справа налево (чтобы не сбить позиции).
  const sortedDesc = [...resolved].sort((a, b) => b.start - a.start)
  let masked = text
  for (const m of sortedDesc) {
    const ph = vault.placeholderFor(m.type, m.value)
    masked = masked.slice(0, m.start) + ph + masked.slice(m.end)
    stats[m.type]++
  }

  return { maskedText: masked, stats, matches: resolved }
}

/**
 * Демаскировать текст ответа модели через vault. Удобный прокси.
 */
export function unmaskText(text: string, vault: PiiVault): string {
  return vault.unmask(text)
}
