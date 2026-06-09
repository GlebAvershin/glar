/**
 * OurApp — глобальный контроллер мастера сценариев.
 *
 * Карточки сценариев (welcome-sidebar, scenario-library) вызывают
 * openScenarioWizard(id). Хост в session.tsx читает сигнал и рендерит overlay.
 *
 * Паттерн совпадает с artifact-preview.tsx (модульный signal-singleton).
 */
import { createSignal } from "solid-js"
import { scenarioById } from "./index"
import type { Scenario } from "./types"

const [activeScenario, setActiveScenario] = createSignal<Scenario | null>(null)

/** Открыть мастер по id сценария. Возвращает true если сценарий найден. */
export function openScenarioWizard(scenarioId: string): boolean {
  const scenario = scenarioById(scenarioId)
  if (!scenario) return false
  setActiveScenario(scenario)
  return true
}

export function closeScenarioWizard() {
  setActiveScenario(null)
}

export function useScenarioWizard() {
  return {
    scenario: activeScenario,
    open: openScenarioWizard,
    close: closeScenarioWizard,
  }
}
