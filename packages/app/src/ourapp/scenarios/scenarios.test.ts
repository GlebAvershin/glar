/**
 * OurApp — проверка консистентности сценариев (ТЗ-01 §10).
 *
 * Гарантирует, что каждый {{placeholder}} в promptTemplate покрыт id шага.
 * Запуск: bun test (из packages/app).
 */
import { describe, expect, test } from "bun:test"
import { SCENARIOS } from "./index"
import { findMissingPlaceholders, renderTemplate } from "./render-template"

describe("scenarios library", () => {
  test("все сценарии имеют уникальные id", () => {
    const ids = SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test("каждый placeholder промпта покрыт id шага", () => {
    for (const scenario of SCENARIOS) {
      const stepIds = scenario.steps.map((s) => s.id)
      const missing = findMissingPlaceholders(scenario.promptTemplate, stepIds)
      expect(missing, `${scenario.id}: незакрытые плейсхолдеры ${missing.join(", ")}`).toEqual([])
    }
  })

  test("каждый сценарий принадлежит хотя бы одной вертикали", () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.verticals.length, scenario.id).toBeGreaterThan(0)
    }
  })

  test("renderTemplate подставляет значения и условные блоки", () => {
    const out = renderTemplate(
      "Привет {{name}}.{{#flag}} Флаг включён.{{/flag}}{{^flag}} Флаг выключен.{{/flag}}",
      { name: "Мир", flag: true },
    )
    expect(out).toBe("Привет Мир. Флаг включён.")
  })

  test("renderTemplate инвертированный блок при falsy", () => {
    const out = renderTemplate("{{#x}}есть{{/x}}{{^x}}нет{{/x}}", { x: "" })
    expect(out).toBe("нет")
  })

  test("не менее 5 сценариев на вертикаль (MVP-объём)", () => {
    const lawyer = SCENARIOS.filter((s) => s.verticals.includes("lawyer"))
    const accountant = SCENARIOS.filter((s) => s.verticals.includes("accountant"))
    expect(lawyer.length).toBeGreaterThanOrEqual(5)
    expect(accountant.length).toBeGreaterThanOrEqual(5)
  })
})
