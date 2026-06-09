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
import { getVault } from "./session-vaults"

declare global {
  interface Window {
    ourappUnmask?: (text: string, sessionId?: string) => string
  }
}

if (typeof window !== "undefined") {
  window.ourappUnmask = (text: string, sessionId?: string) => {
    if (!text || !sessionId) return text
    const vault = getVault(sessionId)
    if (!vault || vault.size === 0) return text
    return vault.unmask(text)
  }
}

export {}
