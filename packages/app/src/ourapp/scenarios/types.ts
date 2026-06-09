/**
 * OurApp — типы сценариев-мастеров (ТЗ-01).
 *
 * Каждый сценарий — JSON-конфиг: набор шагов формы + шаблон промпта.
 * Юзер заполняет форму → renderTemplate подставляет ответы → промпт уходит
 * через обычный sendFollowupDraft (реюз streaming/guard/billing).
 */

export type Vertical = "lawyer" | "accountant"

export type RecommendedModel = "claude-sonnet" | "claude-opus" | "gigachat-pro" | "gigachat-max"

/** Что делать с результатом после ответа модели. */
export type ResultAction =
  | { type: "show_in_chat" }
  | { type: "generate_docx"; filenameTemplate: string }
  | { type: "generate_table" }

export interface Scenario {
  /** Уникальный идентификатор. snake_case / dot.case. */
  id: string
  /** Вертикали, в которых сценарий показывается. */
  verticals: Vertical[]
  /** Краткое название в сайдбаре / карточке. */
  title: string
  /** Короткое описание (tooltip / карточка). */
  lede: string
  /** Иконка (имя из icon.tsx или эмодзи). */
  icon?: string
  /** Большая карточка (span 2×) в editorial-сетке. */
  feature?: boolean
  /** Шаги мастера. */
  steps: ScenarioStep[]
  /** Шаблон системного промпта. Подставляются ответы как {{step_id}}. */
  promptTemplate: string
  /** Рекомендуемая модель (если не указана — юзер выбирает сам). */
  preferredModel?: RecommendedModel
  /** Что делать с результатом. */
  resultAction: ResultAction
}

export type ScenarioStep =
  | TextStep
  | LongTextStep
  | SelectStep
  | FileUploadStep
  | BooleanStep
  | DateStep

export interface BaseStep {
  /** snake_case, попадает в шаблон как {{step_id}}. */
  id: string
  /** Основной вопрос. */
  label: string
  /** Подсказка под полем. */
  hint?: string
  /** Обязательный ли шаг. */
  required?: boolean
}

export interface TextStep extends BaseStep {
  type: "text"
  placeholder?: string
  maxLength?: number
}

export interface LongTextStep extends BaseStep {
  type: "long_text"
  placeholder?: string
  rows?: number
}

export interface SelectStep extends BaseStep {
  type: "select"
  options: Array<{ value: string; label: string; description?: string }>
}

export interface FileUploadStep extends BaseStep {
  type: "file_upload"
  /** [".pdf", ".docx"] */
  accept: string[]
  multiple?: boolean
}

export interface BooleanStep extends BaseStep {
  type: "boolean"
}

export interface DateStep extends BaseStep {
  type: "date"
}

/** Значение ответа на шаг. file_upload хранит список File. */
export type StepValue = string | boolean | File[] | undefined

export type ScenarioAnswers = Record<string, StepValue>
