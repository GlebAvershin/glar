/**
 * OurApp — лёгкий Mustache-like движок подстановки для промптов сценариев.
 *
 * Поддержка:
 *   {{key}}              — подстановка значения (строка/булево/дата)
 *   {{#key}}...{{/key}}  — условный блок (рендерится если значение truthy)
 *   {{^key}}...{{/key}}  — инвертированный блок (рендерится если falsy)
 *
 * file_upload значения в шаблон не подставляются как текст — файлы
 * прикрепляются отдельно (см. run-scenario.ts). В шаблоне на них можно
 * ссылаться условным блоком {{#has_file}} ... {{/has_file}}.
 */
import type { ScenarioAnswers, StepValue } from "./types"

function isTruthy(value: StepValue): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function asText(value: StepValue): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "boolean") return value ? "да" : "нет"
  if (Array.isArray(value)) return value.map((f) => f.name).join(", ")
  return String(value)
}

export function renderTemplate(template: string, answers: ScenarioAnswers): string {
  // 1. Условные блоки {{#key}}...{{/key}} и {{^key}}...{{/key}}.
  //    Обрабатываем нерекурсивно — вложенность в наших шаблонах не используется.
  const sectionRe = /\{\{([#^])\s*([\w.]+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g
  let out = template.replace(sectionRe, (_match, kind: string, key: string, body: string) => {
    const truthy = isTruthy(answers[key])
    const show = kind === "#" ? truthy : !truthy
    return show ? body : ""
  })

  // 2. Простые подстановки {{key}}.
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => asText(answers[key]))

  // 3. Чистим тройные+ переводы строк, оставшиеся от вырезанных блоков.
  return out.replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * Проверка консистентности сценария: все плейсхолдеры {{xxx}} (кроме
 * служебных) должны быть покрыты id шагов. Возвращает список ненайденных.
 * Используется в unit-тестах (validateScenario).
 */
export function findMissingPlaceholders(template: string, stepIds: string[]): string[] {
  const known = new Set(stepIds)
  const found = new Set<string>()
  const re = /\{\{[#^/]?\s*([\w.]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    const key = m[1]!
    if (!known.has(key)) found.add(key)
  }
  return [...found]
}
