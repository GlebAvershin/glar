/**
 * OurApp auth storage — JWT session token для billing-сервера.
 *
 * Phase 1: localStorage в renderer'е (минимум для dev).
 * Phase 2+: electron-store через platform.storage с шифрованием.
 *
 * Token формат — JWT от /auth/verify, кладётся в Authorization: Bearer.
 */

const STORAGE_KEY = "ourapp.session.token"

export function getSessionToken(): string | null {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    return t && t.length > 0 ? t : null
  } catch {
    return null
  }
}

export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token)
  } catch {}
  window.dispatchEvent(new CustomEvent("ourapp:session-changed", { detail: { token } }))
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
  window.dispatchEvent(new CustomEvent("ourapp:session-changed", { detail: { token: null } }))
}

export function isLoggedIn(): boolean {
  return getSessionToken() !== null
}
