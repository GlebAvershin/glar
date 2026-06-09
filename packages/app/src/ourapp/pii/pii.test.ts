/**
 * OurApp — тесты PII-маскера (ТЗ-04 §9).
 *
 * Покрытие: каждый детектор + контрольные суммы + whitelist + консистентность +
 * round-trip + пересечения + режимы + образец договора.
 */
import { describe, expect, test } from "bun:test"
import {
  detectAll,
  detectCard,
  detectFio,
  detectInn,
  detectOgrn,
  detectPassport,
  detectSnils,
} from "./detectors"
import { maskText, PiiVault, normalizeValue, unmaskText } from "./masker"
import { isValidInn, isValidLuhn, isValidOgrn, isValidSnils } from "./validators"

const M = (mode: "off" | "soft" | "strict") => ({ mode })

describe("validators (контрольные суммы)", () => {
  test("ИНН-10: реальный (Сбербанк) валиден", () => {
    expect(isValidInn("7707083893")).toBe(true)
  })
  test("ИНН-12: валидный физлица", () => {
    expect(isValidInn("500100732259")).toBe(true)
  })
  test("ИНН с битой контрольной суммой — invalid", () => {
    expect(isValidInn("7707083894")).toBe(false)
    expect(isValidInn("1234567890")).toBe(false)
  })

  test("СНИЛС: валидный", () => {
    expect(isValidSnils("112-233-445 95")).toBe(true)
  })
  test("СНИЛС с битой контрольной — invalid", () => {
    expect(isValidSnils("112-233-445 00")).toBe(false)
  })

  test("ОГРН: валидный 13", () => {
    expect(isValidOgrn("1027700132195")).toBe(true)
  })
  test("ОГРН с битой контрольной — invalid", () => {
    expect(isValidOgrn("1027700132196")).toBe(false)
  })

  test("Luhn: валидная тестовая карта", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(true)
  })
  test("Luhn: случайные 16 цифр — invalid", () => {
    expect(isValidLuhn("1234 5678 9012 3456")).toBe(false)
  })
})

describe("detectors", () => {
  test("ИНН ловится только с валидной контрольной суммой", () => {
    const found = detectInn("ИНН 7707083893 (Сбербанк) — но 1234567890 — мусор")
    // Сбербанк whitelist'ed → не должен попасть
    expect(found.find((m) => m.value === "1234567890")).toBeUndefined()
  })

  test("ИНН-10 нормального юрлица детектится", () => {
    // 5024141730 — валидный по контрольной сумме (рассчитано вручную):
    // 5*2+0*4+2*10+4*3+1*5+4*9+1*4+7*6+3*8 = 153; (153 % 11) % 10 = 0 → совпадает с 10-й цифрой
    const validInn = "5024141730"
    expect(isValidInn(validInn)).toBe(true)
    const found = detectInn(`Контрагент ИНН ${validInn}`)
    expect(found.length).toBeGreaterThanOrEqual(1)
    expect(found[0]!.type).toBe("inn_org")
  })

  test("Паспорт: серия+номер с маркером", () => {
    const found = detectPassport("паспорт серия 7712 345678 выдан 01.01.2010")
    expect(found.length).toBeGreaterThanOrEqual(1)
    expect(found[0]!.confidence).toBeGreaterThan(0.7)
  })

  test("СНИЛС: формат ловится", () => {
    const found = detectSnils("СНИЛС 112-233-445 95")
    expect(found.length).toBe(1)
  })

  test("ОГРН: 13-значный с валидной контрольной", () => {
    const found = detectOgrn("ОГРН 1027700132195 — Сбербанк")
    expect(found.length).toBe(1)
  })

  test("Карта по Luhn", () => {
    const found = detectCard("оплата картой 4242 4242 4242 4242")
    expect(found.length).toBe(1)
    expect(found[0]!.type).toBe("card")
  })

  test("Карта: 16 случайных цифр — НЕ ловится", () => {
    const found = detectCard("номер 1234 5678 9012 3456 не карта")
    expect(found.length).toBe(0)
  })

  test("ФИО: полное с отчеством на -вич", () => {
    const found = detectFio("Договор подписал Петров Иван Сидорович")
    expect(found.length).toBeGreaterThanOrEqual(1)
    const fio = found.find((m) => m.value === "Петров Иван Сидорович")
    expect(fio).toBeDefined()
  })

  test("ФИО: «Фамилия И.О.» из словаря", () => {
    const found = detectFio("От заказчика — Иванов И. И.")
    expect(found.find((m) => m.value.startsWith("Иванов"))).toBeDefined()
  })
})

describe("whitelist", () => {
  test("ст. 614 ГК РФ — НЕ маскируется в полном пайплайне", () => {
    const v = new PiiVault()
    const r = maskText("Применяется ст. 614 ГК РФ к договору.", v, M("strict"))
    expect(r.maskedText).toContain("ст. 614 ГК РФ")
  })

  test("152-ФЗ — НЕ маскируется", () => {
    const v = new PiiVault()
    const r = maskText("На основании 152-ФЗ обработка ПДн.", v, M("strict"))
    expect(r.maskedText).toContain("152-ФЗ")
  })

  test("Whitelisted ИНН Сбербанка не попадает в матчи", () => {
    const found = detectInn("Получатель ИНН 7707083893")
    expect(found.length).toBe(0)
  })
})

describe("masker — Vault и round-trip", () => {
  test("Round-trip: mask → unmask возвращает исходный текст", () => {
    const text = "Иванов Иван Иванович, ИНН 500100732259, тел +7 999 123-45-67"
    const v = new PiiVault()
    const r = maskText(text, v, M("strict"))
    expect(r.maskedText).not.toContain("Иванов Иван Иванович")
    expect(unmaskText(r.maskedText, v)).toBe(text)
  })

  test("Консистентность: одно и то же ФИО → один плейсхолдер", () => {
    const text =
      "Петров Иван Сидорович подписал. Позже Петров Иван Сидорович подтвердил."
    const v = new PiiVault()
    const r = maskText(text, v, M("strict"))
    const ph = "__PII_FIO_1__"
    const occurrences = r.maskedText.split(ph).length - 1
    expect(occurrences).toBe(2)
    // Второго плейсхолдера ФИО быть не должно
    expect(r.maskedText.includes("__PII_FIO_2__")).toBe(false)
  })

  test("Разные ФИО → разные плейсхолдеры", () => {
    const text = "Петров Иван Сидорович и Сидоров Пётр Иванович"
    const v = new PiiVault()
    const r = maskText(text, v, M("strict"))
    expect(r.maskedText.includes("__PII_FIO_1__")).toBe(true)
    expect(r.maskedText.includes("__PII_FIO_2__")).toBe(true)
  })
})

describe("режимы", () => {
  test("off — текст не меняется", () => {
    const v = new PiiVault()
    const text = "Иванов Иван Иванович, паспорт 7712 345678"
    const r = maskText(text, v, M("off"))
    expect(r.maskedText).toBe(text)
  })

  test("soft — маскирует только паспорт/карту/СНИЛС", () => {
    const v = new PiiVault()
    const text = "Иванов И.И., паспорт 7712 345678, ИНН 500100732259"
    const r = maskText(text, v, M("soft"))
    expect(r.maskedText).toContain("__PII_PASS_")
    expect(r.maskedText).toContain("Иванов") // ФИО НЕ маскируется
    expect(r.maskedText).toContain("500100732259") // ИНН НЕ маскируется
  })

  test("strict — маскирует всё", () => {
    const v = new PiiVault()
    const text = "Петров Иван Сидорович, паспорт 7712 345678, ИНН 500100732259"
    const r = maskText(text, v, M("strict"))
    expect(r.maskedText).not.toContain("Петров Иван Сидорович")
    expect(r.maskedText).not.toContain("500100732259")
  })
})

describe("normalizeValue", () => {
  test("Паспорт: пробелы убираются", () => {
    expect(normalizeValue("passport", "77 12 345678")).toBe("7712345678")
    expect(normalizeValue("passport", "7712 345678")).toBe("7712345678")
  })
  test("Телефон: 8 → 7", () => {
    expect(normalizeValue("phone", "8 (999) 123-45-67")).toBe("79991234567")
    expect(normalizeValue("phone", "+7 999 123-45-67")).toBe("79991234567")
  })
  test("Email: lowercase", () => {
    expect(normalizeValue("email", "Foo@Bar.RU")).toBe("foo@bar.ru")
  })
})

describe("реальный договор-образец", () => {
  test("ФИО, ИНН, паспорт замаскированы; статьи ГК — нет", () => {
    const text = `
ДОГОВОР № 1/2026

Иванов Иван Иванович (паспорт 7712 345678, ИНН 500100732259), именуемый
«Заказчик», с одной стороны, и Петров Пётр Петрович, именуемый «Исполнитель»,
с другой стороны, заключили настоящий договор в соответствии со ст. 779 ГК РФ.

В соответствии с п. 1 ст. 781 ГК РФ Заказчик обязуется оплатить услуги.
Тел. для связи: +7 999 123-45-67.
`.trim()
    const v = new PiiVault()
    const r = maskText(text, v, M("strict"))
    // Чувствительные данные замаскированы
    expect(r.maskedText).not.toContain("Иванов Иван Иванович")
    expect(r.maskedText).not.toContain("500100732259")
    expect(r.maskedText).not.toContain("7712 345678")
    // Ссылки на статьи — сохранены
    expect(r.maskedText).toContain("ст. 779 ГК РФ")
    expect(r.maskedText).toContain("ст. 781 ГК РФ")
    // Round-trip
    expect(unmaskText(r.maskedText, v)).toBe(text)
  })
})

describe("detectAll интеграция", () => {
  test("На пустом тексте — пусто", () => {
    expect(detectAll("")).toEqual([])
  })
  test("На обычном тексте без ПДн — пусто или почти пусто", () => {
    const matches = detectAll("Это обычный текст без чувствительных данных.")
    expect(matches.length).toBe(0)
  })
})
