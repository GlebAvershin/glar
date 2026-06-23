/**
 * OurApp — регистрация глобального window.ourappUnmask (ТЗ-04 §6).
 *
 * UI-пакет (@opencode-ai/ui) живёт в отдельной модульной границе и не должен
 * импортировать из @/ourapp напрямую (cross-package import запрещён).
 *
 * Решение: ourapp регистрирует функцию демаскирования в window. UI зовёт её
 * как опциональный hook: `window.ourappUnmask?.(text, sessionID) ?? text`.
 * Если ourapp не загрузился — рендер работает как обычно.
 *
 * Импортировать этот файл один раз в app.tsx (side-effect).
 */
import { unmaskWithFallback } from "./session-vaults"

declare global {
  interface Window {
    ourappUnmask?: (text: string, sessionId?: string) => string
  }
}

if (typeof window !== "undefined") {
  // sessionId может прийти пустым (баг рендера на вебе — message.sessionID иногда не
  // проставлен) → unmaskWithFallback демаскирует по всем загруженным vault'ам.
  // Персист vault'ов в localStorage (session-vaults) даёт демаскирование после reload.
  window.ourappUnmask = (text: string, sessionId?: string) => unmaskWithFallback(text, sessionId)
}

export {}
