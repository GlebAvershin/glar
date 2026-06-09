/**
 * OurApp — детекторы ПДн РФ (ТЗ-04 §4).
 *
 * Каждый детектор — функция (text) => PiiMatch[]. Регексы + контрольные суммы
 * + контекст-маркеры. Контрольные суммы критичны для отсутствия false-positive
 * (без них любая последовательность цифр = «ИНН»).
 */
import {
  COMMON_FIRST_NAMES,
  COMMON_LAST_NAMES,
  PATRONYMIC_ENDINGS,
  PASSPORT_MARKERS,
  INN_MARKERS,
  SNILS_MARKERS,
  ACCOUNT_MARKERS,
  PHONE_MARKERS,
  BIRTHDATE_MARKERS,
  ADDRESS_MARKERS,
} from "./dictionaries"
import type { PiiMatch, PiiType } from "./types"
import {
  isValidInn,
  isValidLuhn,
  isValidOgrn,
  isValidSnils,
  isValidBankAccountStructure,
} from "./validators"
import { isWhitelistedInn } from "./whitelist"

// Окно вокруг матча для проверки контекст-маркеров (±48 символов).
const CONTEXT_WINDOW = 48

function hasNearby(text: string, pos: number, markers: readonly string[]): boolean {
  const start = Math.max(0, pos - CONTEXT_WINDOW)
  const end = Math.min(text.length, pos + CONTEXT_WINDOW)
  const around = text.slice(start, end).toLowerCase()
  return markers.some((m) => around.includes(m.toLowerCase()))
}

function pushMatch(
  out: PiiMatch[],
  type: PiiType,
  start: number,
  end: number,
  value: string,
  confidence: number,
) {
  out.push({ type, start, end, value, confidence })
}

// ===== Паспорт РФ: серия (4 цифры) + номер (6 цифр), всего 10 =====
export function detectPassport(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  // 7712 345678 / 77 12 345678 / 7712345678 (с маркером "паспорт"/"серия")
  const re = /\b(\d{2})\s?(\d{2})\s+(\d{6})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    const conf = hasNearby(text, start, PASSPORT_MARKERS) ? 0.95 : 0.55
    pushMatch(out, "passport", start, end, m[0], conf)
  }
  // Слитная форма "паспорт 7712345678"
  const reTight = /\b(?:паспорт|серия)[^\d]{0,8}(\d{10})\b/gi
  while ((m = reTight.exec(text)) !== null) {
    const value = m[1]!
    const offset = m[0].lastIndexOf(value)
    const start = m.index + offset
    const end = start + value.length
    pushMatch(out, "passport", start, end, value, 0.92)
  }
  return out
}

// ===== ИНН (физ 12 / юр 10) с контрольной суммой =====
export function detectInn(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  const re = /\b\d{10}(?:\d{2})?\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[0]
    if (!isValidInn(value)) continue
    if (isWhitelistedInn(value)) continue
    const start = m.index
    const end = start + value.length
    const hasMarker = hasNearby(text, start, INN_MARKERS)
    const type: PiiType = value.length === 12 ? "inn_person" : "inn_org"
    // С маркером — высокая уверенность; без — средняя (контр. сумма уже даёт высокую вероятность)
    pushMatch(out, type, start, end, value, hasMarker ? 0.99 : 0.85)
  }
  return out
}

// ===== СНИЛС =====
export function detectSnils(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  const re = /\b\d{3}[-\s]\d{3}[-\s]\d{3}[\s\-]\d{2}\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[0]
    if (!isValidSnils(value)) continue
    const start = m.index
    const end = start + value.length
    const conf = hasNearby(text, start, SNILS_MARKERS) ? 0.99 : 0.92
    pushMatch(out, "snils", start, end, value, conf)
  }
  return out
}

// ===== ОГРН (13) / ОГРНИП (15) =====
export function detectOgrn(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  const re = /\b\d{13}(?:\d{2})?\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[0]
    // 13 (ОГРН) или 15 (ОГРНИП)
    if (value.length !== 13 && value.length !== 15) continue
    if (!isValidOgrn(value)) continue
    pushMatch(out, "ogrn", m.index, m.index + value.length, value, 0.95)
  }
  return out
}

// ===== Расчётный счёт (20 цифр + маркер) =====
export function detectBankAccount(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  const re = /\b\d{20}\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[0]
    if (!isValidBankAccountStructure(value)) continue
    // Без маркера 20 цифр — слишком ненадёжно (mожет быть инвентарный номер).
    const hasMarker = hasNearby(text, m.index, ACCOUNT_MARKERS)
    if (!hasMarker) continue
    pushMatch(out, "bank_account", m.index, m.index + value.length, value, 0.9)
  }
  return out
}

// ===== Карта (Luhn) =====
export function detectCard(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  // 16 цифр сплошняком ИЛИ через пробелы/дефисы блоками по 4
  const re = /\b(?:\d{4}[\s-]){3}\d{4}\b|\b\d{16}\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[0]
    if (!isValidLuhn(value)) continue
    pushMatch(out, "card", m.index, m.index + value.length, value, 0.97)
  }
  return out
}

// ===== Телефон РФ =====
export function detectPhone(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  const re = /(?:\+7|8)[\s\-(]?\d{3}[\s\-)]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[0]
    const start = m.index
    const conf = hasNearby(text, start, PHONE_MARKERS) ? 0.95 : 0.85
    pushMatch(out, "phone", start, start + value.length, value, conf)
  }
  return out
}

// ===== Email =====
export function detectEmail(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[0]
    pushMatch(out, "email", m.index, m.index + value.length, value, 0.99)
  }
  return out
}

// ===== Дата рождения =====
export function detectBirthdate(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  const re = /\b(\d{2})\.(\d{2})\.(\d{4})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const day = parseInt(m[1]!, 10)
    const month = parseInt(m[2]!, 10)
    const year = parseInt(m[3]!, 10)
    if (day < 1 || day > 31 || month < 1 || month > 12) continue
    if (year < 1900 || year > 2025) continue
    const start = m.index
    const hasMarker = hasNearby(text, start, BIRTHDATE_MARKERS)
    // Без маркера дата может быть любой (срок договора, дата выдачи) — не маскируем.
    if (!hasMarker) continue
    pushMatch(out, "birthdate", start, start + m[0].length, m[0], 0.85)
  }
  return out
}

// ===== Адрес =====
export function detectAddress(text: string): PiiMatch[] {
  const out: PiiMatch[] = []
  // Самый частый паттерн: "г. Москва, ул. Тверская, д. 1, кв. 5"
  // Берём адресные «куски» — последовательности с маркерами через запятую/пробел.
  const re =
    /(?:индекс[:\s]+\d{6}[,\s]+)?(?:г\.\s?[А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+)?[,\s]*)?(?:(?:ул|пр-?т|пер|наб|пл|ш|пр-?д|б-?р)\.\s?[А-ЯЁа-яё][а-яё-]+(?:\s+[А-ЯЁа-яё][а-яё-]+){0,3})[,\s]+д\.\s?\d+[а-я]?(?:[,\s]+(?:к(?:орп)?\.\s?\d+))?(?:[,\s]+кв\.\s?\d+[а-я]?)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = m[0].trim()
    if (value.length < 10) continue
    const start = m.index + (m[0].indexOf(value) >= 0 ? m[0].indexOf(value) : 0)
    pushMatch(out, "address", start, start + value.length, value, 0.85)
  }
  // Запасной вариант — упоминание «г. <Город>, ул. <название>, д. <N>»
  const reSimple = /г\.\s?[А-ЯЁ][а-яё-]+,\s+ул\.\s?[А-ЯЁа-яё][а-яё-]+(?:\s+[А-ЯЁа-яё][а-яё-]+)?,\s+д\.\s?\d+[а-я]?/g
  while ((m = reSimple.exec(text)) !== null) {
    const value = m[0]
    const start = m.index
    const end = start + value.length
    // Дедуп: если уже есть пересечение
    if (out.some((x) => x.type === "address" && x.start < end && x.end > start)) continue
    pushMatch(out, "address", start, end, value, 0.8)
  }
  return out
}

// ===== ФИО =====
export function detectFio(text: string): PiiMatch[] {
  const out: PiiMatch[] = []

  // Cyrillic word boundary: предыдущий/следующий символ — НЕ кириллица. JS \b
  // работает только с ASCII, поэтому используем lookarounds.
  const CYR_BEFORE = "(?<![А-Яа-яёЁ])"
  const CYR_AFTER = "(?![А-Яа-яёЁ])"

  // Паттерн 1: "Фамилия Имя Отчество" (3 слова с заглавной), отчество с типичным окончанием.
  const reFull = new RegExp(
    `${CYR_BEFORE}([А-ЯЁ][а-яё-]+)\\s+([А-ЯЁ][а-яё-]+)\\s+([А-ЯЁ][а-яё-]+(?:вич|вна|ьич|ична|инична|оглы|кызы|оглу))${CYR_AFTER}`,
    "g",
  )
  let m: RegExpExecArray | null
  while ((m = reFull.exec(text)) !== null) {
    const value = m[0]
    pushMatch(out, "fio", m.index, m.index + value.length, value, 0.97)
  }

  // Паттерн 2: "Фамилия И.О." / "Фамилия И. О."
  const reShort = new RegExp(
    `${CYR_BEFORE}([А-ЯЁ][а-яё-]+)\\s+([А-ЯЁ])\\.\\s?([А-ЯЁ])\\.${CYR_AFTER}`,
    "g",
  )
  while ((m = reShort.exec(text)) !== null) {
    const last = m[1]!
    const value = m[0]
    const inDict = COMMON_LAST_NAMES.has(last)
    const conf = inDict ? 0.95 : 0.7
    pushMatch(out, "fio", m.index, m.index + value.length, value, conf)
  }

  // Паттерн 3: словарная фамилия + имя (без отчества).
  const reDict = new RegExp(
    `${CYR_BEFORE}([А-ЯЁ][а-яё-]+)\\s+([А-ЯЁ][а-яё-]+)${CYR_AFTER}`,
    "g",
  )
  while ((m = reDict.exec(text)) !== null) {
    const a = m[1]!
    const b = m[2]!
    const value = m[0]
    const start = m.index
    const end = start + value.length
    // Уже покрыто полным паттерном?
    if (out.some((x) => x.type === "fio" && x.start <= start && x.end >= end)) continue
    const isFioOrder = COMMON_LAST_NAMES.has(a) && COMMON_FIRST_NAMES.has(b)
    const isReverse = COMMON_FIRST_NAMES.has(a) && COMMON_LAST_NAMES.has(b)
    if (!isFioOrder && !isReverse) continue
    pushMatch(out, "fio", start, end, value, 0.85)
  }

  // unused import guard
  void PATRONYMIC_ENDINGS
  void ADDRESS_MARKERS

  return out
}

/** Запустить все детекторы. */
export function detectAll(text: string): PiiMatch[] {
  return [
    ...detectPassport(text),
    ...detectInn(text),
    ...detectSnils(text),
    ...detectOgrn(text),
    ...detectBankAccount(text),
    ...detectCard(text),
    ...detectPhone(text),
    ...detectEmail(text),
    ...detectBirthdate(text),
    ...detectAddress(text),
    ...detectFio(text),
  ]
}
