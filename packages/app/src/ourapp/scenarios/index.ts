/**
 * OurApp — реестр всех сценариев-мастеров (ТЗ-01).
 *
 * Источник правды для UI (библиотека, сайдбар) и аналитики.
 */
import type { Scenario, Vertical } from "./types"
import { LAWYER_SCENARIOS } from "./library/lawyer"
import { ACCOUNTANT_SCENARIOS } from "./library/accountant"

export * from "./types"
export { renderTemplate, findMissingPlaceholders } from "./render-template"

export const SCENARIOS: Scenario[] = [...LAWYER_SCENARIOS, ...ACCOUNTANT_SCENARIOS]

/** Сценарии конкретной вертикали (двухдверный UX). */
export function scenariosFor(vertical: Vertical): Scenario[] {
  return SCENARIOS.filter((s) => s.verticals.includes(vertical))
}

/** Найти сценарий по id. */
export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}
