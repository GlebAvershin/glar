/**
 * OurApp — настройки PII-маскирования (ТЗ-04 §7.1).
 *
 * Хранит выбор пользователя в localStorage. Реактивный сигнал для UI и
 * чистая функция getMode() для использования в pipeline отправки.
 *
 * По умолчанию — strict ВКЛ. Для GigaChat/YandexGPT — auto-off (хостинг РФ,
 * данные не покидают РФ, маскирование вредит качеству).
 */
import { createSignal } from "solid-js"
import type { PiiMode } from "./types"

const STORAGE_KEY = "ourapp.pii.mode"

function readStoredMode(): PiiMode {
  if (typeof localStorage !== "object") return "strict"
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === "off" || v === "soft" || v === "strict") return v
  } catch {}
  return "strict"
}

const [piiMode, setPiiModeSignal] = createSignal<PiiMode>(readStoredMode())

const STORAGE_PREVIEW_KEY = "ourapp.pii.preview"

function readStoredPreview(): boolean {
  if (typeof localStorage !== "object") return false
  try {
    return localStorage.getItem(STORAGE_PREVIEW_KEY) === "1"
  } catch {
    return false
  }
}

const [piiPreviewEnabled, setPiiPreviewSignal] = createSignal<boolean>(readStoredPreview())

export function getPiiMode(): PiiMode {
  return piiMode()
}

export function setPiiMode(mode: PiiMode) {
  setPiiModeSignal(mode)
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {}
}

export function getPiiPreviewEnabled(): boolean {
  return piiPreviewEnabled()
}

export function setPiiPreviewEnabled(value: boolean) {
  setPiiPreviewSignal(value)
  try {
    localStorage.setItem(STORAGE_PREVIEW_KEY, value ? "1" : "0")
  } catch {}
}

export { piiMode, piiPreviewEnabled }

/**
 * Поставщики/модели РФ — для них маскирование вредит и не нужно (152-ФЗ ОК).
 * Список соответствует тарифным моделям из billing/seed.ts.
 */
const RU_HOSTED_MODELS = new Set([
  "gigachat-lite",
  "gigachat-pro",
  "gigachat-max",
  "yandexgpt-lite",
  "yandexgpt-pro",
])

const RU_HOSTED_PROVIDERS = new Set(["gigachat", "yandex"])

/** True если модель/провайдер хостятся в РФ — маскирование можно отключить. */
export function isRussianHostedModel(modelCode?: string, provider?: string): boolean {
  if (modelCode && RU_HOSTED_MODELS.has(modelCode.toLowerCase())) return true
  if (provider && RU_HOSTED_PROVIDERS.has(provider.toLowerCase())) return true
  if (modelCode && /^(gigachat|yandex)/i.test(modelCode)) return true
  return false
}

/** Эффективный режим с учётом auto-off для РФ-моделей. */
export function effectivePiiMode(modelCode?: string, provider?: string): PiiMode {
  if (isRussianHostedModel(modelCode, provider)) return "off"
  return getPiiMode()
}
