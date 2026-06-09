/**
 * OurApp — построение запроса из заполненного сценария (ТЗ-01 §6).
 *
 * Превращает сценарий + ответы в `Prompt` (ContentPart[]), который ставится
 * в composer и отправляется через обычный sendFollowupDraft — так мы
 * реюзаем streaming, guard кредитов и billing.
 *
 * file_upload шаги парсятся локально (parseOfficeDocumentLocally) и
 * прикрепляются как image-attachment-part с extractedText + mime "ourapp/office"
 * — ровно как делает composer (attachments.ts). build-request-parts.ts затем
 * инлайнит их текст в запрос, поэтому даже GigaChat «видит» документы.
 */
import { uuid } from "@/utils/uuid"
import type { ContentPart, ImageAttachmentPart } from "@/context/prompt"
import { parseOfficeDocumentLocally } from "../doc-parse"
import { renderTemplate } from "./render-template"
import type { Scenario, ScenarioAnswers } from "./types"

export interface BuiltScenarioPrompt {
  /** Готовые части для prompt.set(). */
  parts: ContentPart[]
  /** Сколько файлов прикреплено (для аналитики/UI). */
  attachmentCount: number
}

/**
 * Собрать prompt-части из сценария и ответов. Файлы парсятся параллельно.
 */
export async function buildScenarioPrompt(
  scenario: Scenario,
  answers: ScenarioAnswers,
): Promise<BuiltScenarioPrompt> {
  const text = renderTemplate(scenario.promptTemplate, answers)

  // Собираем все файлы из file_upload шагов.
  const files: File[] = []
  for (const step of scenario.steps) {
    if (step.type !== "file_upload") continue
    const value = answers[step.id]
    if (Array.isArray(value)) files.push(...value)
  }

  const attachments: ImageAttachmentPart[] = []
  for (const file of files) {
    const parsed = await parseOfficeDocumentLocally(file).catch(() => null)
    if (!parsed) continue
    attachments.push({
      type: "image",
      id: uuid(),
      filename: parsed.filename,
      mime: "ourapp/office",
      dataUrl: "",
      extractedText: parsed.text,
    })
  }

  // Порядок: сначала вложения (документы), затем текст-инструкция.
  const parts: ContentPart[] = [
    ...attachments,
    { type: "text", content: text, start: 0, end: text.length },
  ]

  return { parts, attachmentCount: attachments.length }
}

/**
 * Валидация ответов: все required-шаги заполнены. Возвращает id незаполненных.
 */
export function findMissingRequired(scenario: Scenario, answers: ScenarioAnswers): string[] {
  const missing: string[] = []
  for (const step of scenario.steps) {
    if (!step.required) continue
    const value = answers[step.id]
    const filled =
      step.type === "file_upload"
        ? Array.isArray(value) && value.length > 0
        : step.type === "boolean"
          ? typeof value === "boolean"
          : typeof value === "string" && value.trim().length > 0
    if (!filled) missing.push(step.id)
  }
  return missing
}

/** Рекомендуемая для сценария модель-код (для preview стоимости / выбора). */
export function scenarioModelCode(scenario: Scenario): string | undefined {
  return scenario.preferredModel
}
