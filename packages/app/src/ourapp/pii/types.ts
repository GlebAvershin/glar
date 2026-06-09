/**
 * OurApp — типы для маскирования ПДн (ТЗ-04).
 *
 * Принцип: ПДн (ФИО, паспорта, ИНН и т.д.) маскируются в renderer'е ДО отправки
 * в облачные LLM. Vault (плейсхолдер → реальное значение) живёт только в памяти
 * сессии и не уходит в сеть. После ответа модели — обратная подстановка.
 *
 * 152-ФЗ — основной драйвер: трансграничная передача ПДн без согласия запрещена.
 */

export type PiiType =
  | "fio"
  | "passport"
  | "inn_person"
  | "inn_org"
  | "snils"
  | "ogrn"
  | "bank_account"
  | "card"
  | "phone"
  | "email"
  | "address"
  | "birthdate"

export interface PiiMatch {
  type: PiiType
  /** Позиция начала в исходном тексте. */
  start: number
  /** Позиция конца (exclusive) в исходном тексте. */
  end: number
  /** Оригинальное значение (как в тексте). */
  value: string
  /** Уверенность 0..1. Используется для разрешения пересечений. */
  confidence: number
}

/** Режимы маскирования. */
export type PiiMode =
  | "off" // выключено
  | "soft" // только высокочувствительное: паспорт/карта/СНИЛС
  | "strict" // всё (по умолчанию)

/** Опции маскирования. */
export interface MaskOptions {
  mode: PiiMode
  /** Опциональный whitelist для дополнительной фильтрации. */
  whitelistText?: string[]
}

/** Какие типы маскируются в каждом режиме. */
export const MODE_TYPES: Record<PiiMode, ReadonlySet<PiiType>> = {
  off: new Set<PiiType>(),
  soft: new Set<PiiType>(["passport", "card", "snils"]),
  strict: new Set<PiiType>([
    "fio",
    "passport",
    "inn_person",
    "inn_org",
    "snils",
    "ogrn",
    "bank_account",
    "card",
    "phone",
    "email",
    "address",
    "birthdate",
  ]),
}

/** Лейблы плейсхолдеров. Латиница + подчёркивания — устойчиво к токенизации. */
export const LABEL: Record<PiiType, string> = {
  fio: "FIO",
  passport: "PASS",
  inn_person: "INN_P",
  inn_org: "INN_O",
  snils: "SNILS",
  ogrn: "OGRN",
  bank_account: "ACC",
  card: "CARD",
  phone: "PHONE",
  email: "EMAIL",
  address: "ADDR",
  birthdate: "BDATE",
}

/** Человекочитаемые названия (для UI превью). */
export const LABEL_RU: Record<PiiType, string> = {
  fio: "ФИО",
  passport: "паспорт",
  inn_person: "ИНН (физ.)",
  inn_org: "ИНН (юр.)",
  snils: "СНИЛС",
  ogrn: "ОГРН",
  bank_account: "расч. счёт",
  card: "карта",
  phone: "телефон",
  email: "email",
  address: "адрес",
  birthdate: "дата рождения",
}

/** Полная статистика маскирования (для UI/превью). */
export type MaskStats = Record<PiiType, number>

export interface MaskResult {
  /** Текст с подставленными плейсхолдерами. */
  maskedText: string
  /** Сколько каждого типа замаскировано. */
  stats: MaskStats
  /** Список всех применённых матчей (для подсветки в превью). */
  matches: PiiMatch[]
}
