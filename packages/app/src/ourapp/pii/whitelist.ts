/**
 * OurApp — whitelist для PII-маскера (ТЗ-04 §4).
 *
 * Эти строки/паттерны НЕ должны маскироваться, даже если попадают под детектор.
 * Сюда входят:
 *   - публичные ИНН государственных ведомств
 *   - названия ведомств
 *   - ссылки на статьи законов
 *   - юридические термины
 */

/** Публичные ИНН гос. органов и ведомств — НЕ маскировать. */
export const GOV_INN: ReadonlySet<string> = new Set([
  "7707083893", // Сбербанк России (публ. реквизиты часто в шаблонах)
  "7710140679", // ФНС России (центральный аппарат)
  "7707049388", // Минфин России
  "7704211201", // Минэкономразвития
  "7706074737", // ЦБ РФ
  "7708207520", // Роскомнадзор
])

/** Регексы для ссылок на статьи законов — диапазоны помечать как whitelist. */
export const LAW_REFERENCE_PATTERNS: RegExp[] = [
  // ст. 614 ГК РФ, ст.614 ГК, ст. 614 НК РФ
  /\bст\.?\s?\d+(?:\.\d+)?\s+(ГК|НК|УК|КоАП|ТК|АПК|ГПК|ЖК|СК|БК|ЗК)(?:\s+РФ)?/gi,
  // п. 1 ст. 23 НК РФ
  /\bп\.?\s?\d+\s+ст\.?\s?\d+(?:\.\d+)?\s+(ГК|НК|УК|КоАП|ТК|АПК|ГПК|ЖК|СК|БК|ЗК)(?:\s+РФ)?/gi,
  // ч. 2 ст. 14 ...
  /\bч\.?\s?\d+\s+ст\.?\s?\d+(?:\.\d+)?\s+(ГК|НК|УК|КоАП|ТК|АПК|ГПК|ЖК|СК|БК|ЗК)(?:\s+РФ)?/gi,
  // 152-ФЗ, 44-ФЗ
  /\b\d{1,4}-ФЗ\b/g,
  // ПБУ 18/02
  /\bПБУ\s?\d+(?:\/\d+)?/gi,
  // НК РФ, ГК РФ — упоминания самих кодексов
  /\b(НК|ГК|УК|КоАП|ТК|АПК|ГПК|ЖК|СК|БК|ЗК)\s+РФ\b/g,
]

/** Диапазон в тексте, который нельзя трогать. */
export interface ProtectedRange {
  start: number
  end: number
}

/** Найти все защищённые диапазоны в тексте (статьи законов, гос. упоминания). */
export function findProtectedRanges(text: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = []
  for (const pattern of LAW_REFERENCE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g")
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length })
    }
  }
  return ranges
}

/** True, если значение принадлежит whitelist (для ИНН гос. органов). */
export function isWhitelistedInn(value: string): boolean {
  return GOV_INN.has(value.replace(/\D/g, ""))
}

/** True, если match-диапазон пересекается с защищённой областью. */
export function isInProtectedRange(
  start: number,
  end: number,
  ranges: ProtectedRange[],
): boolean {
  for (const r of ranges) {
    if (start < r.end && end > r.start) return true
  }
  return false
}
