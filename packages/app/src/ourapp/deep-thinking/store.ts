/**
 * OurApp — режим «Углублённое размышление» (extended thinking).
 *
 * Бинарный тумблер: ВКЛ → у Claude-моделей включается extended thinking
 * (через opencode variant → нативный thinking-бюджет Anthropic). По умолчанию ВЫКЛ.
 * Хранится в localStorage (как pii/auto-model).
 *
 * Применяется только к reasoning-моделям Claude (sonnet/opus). РФ-модели
 * (GigaChat/YandexGPT) thinking не поддерживают — для них тумблер no-op.
 */
import { createSignal } from "solid-js"

const STORAGE_KEY = "ourapp.deepThinking.enabled"

/** Уровень thinking при включённом режиме (политика). high — сильно, но дешевле max. */
export const DEEP_THINKING_VARIANT = "high"

function readStored(): boolean {
  if (typeof localStorage !== "object") return false
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

const [deepThinkingEnabled, setSignal] = createSignal<boolean>(readStored())

export function getDeepThinkingEnabled(): boolean {
  return deepThinkingEnabled()
}

export function setDeepThinkingEnabled(value: boolean) {
  setSignal(value)
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  } catch {}
}

/** Поддерживает ли модель extended thinking (только Claude sonnet/opus). */
export function isReasoningModel(modelID: string): boolean {
  return /^claude-(sonnet|opus)/i.test(modelID)
}

export { deepThinkingEnabled }
