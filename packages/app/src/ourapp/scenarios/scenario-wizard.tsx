/**
 * OurApp — мастер сценария (ТЗ-01 §4.2).
 *
 * Полноэкранный overlay поверх чата. Header + progress dots + контент шага +
 * footer (Назад / Далее / Запустить). Стиль — DESIGN.md (кремовый, серифный).
 *
 * Контролируемый: получает scenario, при завершении вызывает onRun с
 * собранным prompt'ом. Сам не отправляет — отправку делает родитель
 * (реюз sendFollowupDraft из composer).
 */
import { For, Show, createMemo, createSignal, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@opencode-ai/ui/icon"
import { ScenarioStepField } from "./scenario-steps"
import { buildScenarioPrompt, findMissingRequired, type BuiltScenarioPrompt } from "./run-scenario"
import type { Scenario, ScenarioAnswers, StepValue } from "./types"

export interface ScenarioWizardProps {
  scenario: Scenario
  onClose: () => void
  /** Вызывается с собранным prompt'ом при нажатии «Запустить». */
  onRun: (scenario: Scenario, built: BuiltScenarioPrompt) => void | Promise<void>
}

export const ScenarioWizard: Component<ScenarioWizardProps> = (props) => {
  const [answers, setAnswers] = createStore<ScenarioAnswers>({})
  const [stepIndex, setStepIndex] = createSignal(0)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const steps = () => props.scenario.steps
  const total = () => steps().length
  const current = createMemo(() => steps()[stepIndex()])
  const isLast = () => stepIndex() === total() - 1
  const isFirst = () => stepIndex() === 0

  const setValue = (id: string, value: StepValue) => {
    setAnswers(id, value)
    setError(null)
  }

  const stepFilled = (): boolean => {
    const step = current()
    if (!step?.required) return true
    const value = answers[step.id]
    if (step.type === "file_upload") return Array.isArray(value) && value.length > 0
    if (step.type === "boolean") return typeof value === "boolean"
    return typeof value === "string" && value.trim().length > 0
  }

  const goNext = () => {
    if (!stepFilled()) {
      setError("Заполните это поле, чтобы продолжить.")
      return
    }
    setError(null)
    if (!isLast()) setStepIndex((i) => i + 1)
  }

  const goBack = () => {
    setError(null)
    if (!isFirst()) setStepIndex((i) => i - 1)
  }

  const run = async () => {
    const missing = findMissingRequired(props.scenario, answers)
    if (missing.length > 0) {
      // Перейти к первому незаполненному обязательному шагу.
      const idx = steps().findIndex((s) => s.id === missing[0])
      if (idx >= 0) setStepIndex(idx)
      setError("Заполните обязательные поля.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const built = await buildScenarioPrompt(props.scenario, answers)
      await props.onRun(props.scenario, built)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить сценарий.")
      setBusy(false)
    }
  }

  return (
    <div class="ourapp-wiz" role="dialog" aria-modal="true" aria-label={props.scenario.title}>
      <header class="ourapp-wiz__head">
        <div class="ourapp-wiz__headText">
          <span class="ourapp-wiz__eyebrow">Сценарий</span>
          <h1 class="ourapp-wiz__title">{props.scenario.title}</h1>
        </div>
        <button type="button" class="ourapp-wiz__close" aria-label="Закрыть" onClick={props.onClose}>
          <Icon name="close" class="size-5" />
        </button>
      </header>

      <div class="ourapp-wiz__progress">
        <span class="ourapp-wiz__progressText">
          Шаг {stepIndex() + 1} из {total()}
        </span>
        <div class="ourapp-wiz__dots" aria-hidden>
          <For each={steps()}>
            {(_s, i) => (
              <span
                class="ourapp-wiz__dot"
                classList={{
                  "ourapp-wiz__dot--active": i() === stepIndex(),
                  "ourapp-wiz__dot--done": i() < stepIndex(),
                }}
              />
            )}
          </For>
        </div>
      </div>

      <main class="ourapp-wiz__body">
        <Show when={current()} keyed>
          {(step) => (
            <ScenarioStepField step={step} value={answers[step.id]} onChange={(v) => setValue(step.id, v)} />
          )}
        </Show>
        <Show when={error()}>
          <p class="ourapp-wiz__error">{error()}</p>
        </Show>
      </main>

      <footer class="ourapp-wiz__foot">
        <button
          type="button"
          class="ourapp-btn"
          onClick={goBack}
          disabled={isFirst() || busy()}
        >
          Назад
        </button>
        <Show
          when={isLast()}
          fallback={
            <button type="button" class="ourapp-btn ourapp-btn--primary" onClick={goNext} disabled={busy()}>
              Далее
            </button>
          }
        >
          <button type="button" class="ourapp-btn ourapp-btn--primary" onClick={run} disabled={busy()}>
            {busy() ? "Запускаем…" : "Запустить"}
          </button>
        </Show>
      </footer>
    </div>
  )
}
