/**
 * OurApp — построение запроса из заполненного сценария (ТЗ-01 §6).
 *
 * Превращает сценарий + ответы в `Prompt` (ContentPart[]), который ставится
 * в composer и отправляется через обычный sendFollowupDraft — так мы
 * реюзаем streaming, guard кредитов и billing.
 *
 * file_upload шаги парсятся локально и прикрепляются как image-attachment-part
 * с extractedText — ровно как делает composer (attachments.ts):
 *   - office-документы (PDF/DOCX/XLSX) → parseOfficeDocumentLocally, mime "ourapp/office";
 *   - сканы-картинки (JPG/PNG/…) → ocrImageToText (локальный OCR), mime "ourapp/scanned-doc".
 * submit.ts (sendFollowupDraft) инлайнит текст обеих веток в запрос (поэтому даже
 * GigaChat «видит» документы) и маскирует ПДн для зарубежных моделей (152-ФЗ).
 */
import { uuid } from "@/utils/uuid"
import type { ContentPart, ImageAttachmentPart } from "@/context/prompt"
import { parseOfficeDocumentLocally } from "../doc-parse"
import { ocrImageToText, looksLikeDocumentScan } from "../pii/ocr"
import { renderTemplate } from "./render-template"
import type { Scenario, ScenarioAnswers } from "./types"

/** Скан-картинка (фото/скан документа) — распознаём через OCR, а не office-парсер. */
const IMAGE_EXT = /\.(jpe?g|png|webp|bmp|tiff?)$/i
function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXT.test(file.name)
}

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
    if (isImageFile(file)) {
      // Скан-картинка: распознаём локально (рус+eng), как composer (attachments.ts).
      // В облако уйдёт текст (замаскированный для зарубежных моделей), не картинка с ПДн.
      const result = await ocrImageToText(file).catch(() => null)
      if (!result || !looksLikeDocumentScan(result)) continue
      attachments.push({
        type: "image",
        id: uuid(),
        filename: file.name,
        mime: "ourapp/scanned-doc",
        dataUrl: "",
        extractedText: result.text,
      })
      continue
    }
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
