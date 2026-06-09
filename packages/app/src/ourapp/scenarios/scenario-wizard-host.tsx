/**
 * OurApp — хост мастера сценариев. Рендерится один раз в session.tsx.
 *
 * Читает активный сценарий из wizard-controller, показывает ScenarioWizard
 * как overlay. При «Запустить» строит prompt-части и диспатчит
 * "ourapp:scenario-run" — prompt-input ставит их в composer и авто-отправляет.
 */
import { Show, type Component } from "solid-js"
import { ScenarioWizard } from "./scenario-wizard"
import { useScenarioWizard } from "./wizard-controller"
import type { BuiltScenarioPrompt } from "./run-scenario"
import type { Scenario } from "./types"
import "./scenario-wizard.css"

export const ScenarioWizardHost: Component = () => {
  const wizard = useScenarioWizard()

  const handleRun = (scenario: Scenario, built: BuiltScenarioPrompt) => {
    window.dispatchEvent(
      new CustomEvent("ourapp:scenario-run", {
        detail: {
          scenarioId: scenario.id,
          parts: built.parts,
          preferredModel: scenario.preferredModel,
          resultAction: scenario.resultAction,
          autoSubmit: true,
        },
      }),
    )
    wizard.close()
  }

  return (
    <Show when={wizard.scenario()} keyed>
      {(scenario) => <ScenarioWizard scenario={scenario} onClose={wizard.close} onRun={handleRun} />}
    </Show>
  )
}
