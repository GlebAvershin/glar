/**
 * OurApp — тесты авто-выбора модели (эвристика + резолвинг).
 * bun test
 */
import { describe, expect, test } from "bun:test"
import { classifyRequest, TIER_MODEL } from "./classify"
import { pickAutoModel, type ModelListItem } from "./resolve"

const provider = { id: "anthropic" }
const fullList: ModelListItem[] = [
  { id: "gigachat-lite", provider },
  { id: "gigachat-pro", provider },
  { id: "claude-sonnet", provider },
  { id: "claude-opus", provider },
  { id: "yandexgpt", provider },
]

describe("classifyRequest", () => {
  test("короткий справочный вопрос → lite", () => {
    const r = classifyRequest({ text: "Ставка НДС в 2026?", hasDocument: false })
    expect(r.tier).toBe("lite")
    expect(r.modelCode).toBe(TIER_MODEL.lite)
  })

  test("объяснение/обучающий вопрос → pro (РФ)", () => {
    const r = classifyRequest({ text: "Объясни своими словами статью 54.1 НК", hasDocument: false })
    expect(r.tier).toBe("pro")
    expect(r.modelCode).toBe(TIER_MODEL.pro)
  })

  test("средний по длине запрос без ключевых слов → pro", () => {
    const r = classifyRequest({ text: "в".repeat(600), hasDocument: false })
    expect(r.tier).toBe("pro")
  })

  test("аналитическая задача (проверка рисков) → mid", () => {
    const r = classifyRequest({ text: "Проверь этот договор на риски для покупателя", hasDocument: false })
    expect(r.tier).toBe("mid")
    expect(r.modelCode).toBe(TIER_MODEL.mid)
  })

  test("генеративная задача (составить иск) → top", () => {
    const r = classifyRequest({ text: "Составь исковое заявление о взыскании задолженности", hasDocument: false })
    expect(r.tier).toBe("top")
    expect(r.modelCode).toBe(TIER_MODEL.top)
  })

  test("подготовка договора → top", () => {
    const r = classifyRequest({ text: "Подготовь договор оказания услуг", hasDocument: false })
    expect(r.tier).toBe("top")
  })

  test("нейтральный текст, но есть документ → mid", () => {
    const r = classifyRequest({ text: "Посмотри вложение", hasDocument: true })
    expect(r.tier).toBe("mid")
  })

  test("очень длинный запрос → top", () => {
    const r = classifyRequest({ text: "а".repeat(4200), hasDocument: false })
    expect(r.tier).toBe("top")
  })

  test("средне-длинный запрос без ключевых слов → mid", () => {
    const r = classifyRequest({ text: "б".repeat(1800), hasDocument: false })
    expect(r.tier).toBe("mid")
  })

  test("генеративные слова приоритетнее аналитических", () => {
    // содержит и «проверь», и «составь» — должно победить top
    const r = classifyRequest({ text: "Проверь факты и составь претензию", hasDocument: false })
    expect(r.tier).toBe("top")
  })
})

describe("pickAutoModel", () => {
  test("резолвит точный код в пару provider/model", () => {
    const pick = pickAutoModel({ text: "Что такое НДС?", hasDocument: false }, fullList)
    expect(pick).toBeDefined()
    expect(pick!.modelID).toBe("gigachat-lite")
    expect(pick!.providerID).toBe("anthropic")
  })

  test("деградирует, если выбранной модели нет в списке", () => {
    // нет claude-opus → top должен опуститься до доступного (sonnet)
    const noOpus = fullList.filter((m) => m.id !== "claude-opus")
    const pick = pickAutoModel({ text: "Составь исковое заявление", hasDocument: false }, noOpus)
    expect(pick).toBeDefined()
    expect(pick!.modelID).toBe("claude-sonnet")
  })

  test("undefined, если ни одной модели из пула нет", () => {
    // gpt-4o и deepseek — вне пула claude/gigachat/yandex
    const pick = pickAutoModel({ text: "Что такое НДС?", hasDocument: false }, [
      { id: "gpt-4o", provider },
      { id: "deepseek-v4-flash-free", provider },
    ])
    expect(pick).toBeUndefined()
  })

  test("подбор по семейству с версионным id (claude-opus-4-8)", () => {
    const versioned: ModelListItem[] = [
      { id: "claude-opus-4-8", provider },
      { id: "claude-sonnet-4-5", provider },
      { id: "deepseek-v4-flash-free", provider }, // вне пула — должен игнорироваться
    ]
    const top = pickAutoModel({ text: "Составь исковое заявление", hasDocument: false }, versioned)
    expect(top!.modelID).toBe("claude-opus-4-8")
    const mid = pickAutoModel({ text: "Проверь договор на риски", hasDocument: false }, versioned)
    expect(mid!.modelID).toBe("claude-sonnet-4-5")
  })

  test("если в пуле только Claude — короткий вопрос берёт ближайший Claude", () => {
    const onlyClaude: ModelListItem[] = [
      { id: "claude-opus-4-8", provider },
      { id: "claude-sonnet-4-5", provider },
    ]
    // классификация lite, но gigachat нет → ближайший доступный = sonnet
    const pick = pickAutoModel({ text: "Ставка НДС?", hasDocument: false }, onlyClaude)
    expect(pick).toBeDefined()
    expect(pick!.modelID).toBe("claude-sonnet-4-5")
  })

  test("никогда не выбирает модель вне пула (DeepSeek/GPT)", () => {
    const mixed: ModelListItem[] = [
      { id: "deepseek-v4-flash-free", provider },
      { id: "gpt-4o", provider },
      { id: "gigachat-lite", provider },
    ]
    const pick = pickAutoModel({ text: "Ставка НДС?", hasDocument: false }, mixed)
    expect(pick!.modelID).toBe("gigachat-lite")
  })
})
