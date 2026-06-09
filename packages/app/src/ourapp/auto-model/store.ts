/**
 * OurApp — состояние режима «Авто-выбор модели».
 *
 * Хранит вкл/выкл в localStorage (как pii/settings-store). Реактивный сигнал
 * для UI + чистый геттер для pipeline отправки (submit.ts).
 *
 * По умолчанию ВЫКЛ — пользователь осознанно включает авто-выбор.
 */
import { createSignal } from "solid-js"

const STORAGE_KEY = "ourapp.autoModel.enabled"

function readStored(): boolean {
  if (typeof localStorage !== "object") return false
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

const [autoModelEnabled, setAutoModelSignal] = createSignal<boolean>(readStored())

export function getAutoModelEnabled(): boolean {
  return autoModelEnabled()
}

export function setAutoModelEnabled(value: boolean) {
  setAutoModelSignal(value)
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  } catch {}
}

export { autoModelEnabled }
