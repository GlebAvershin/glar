/**
 * OurApp — per-session PII vaults (ТЗ-04 §6).
 *
 * Хранит Vault для каждой сессии чата. Маскирование при отправке использует
 * этот vault, демаскирование при отображении ответа — тот же. Очищается при
 * закрытии сессии (cleanupSession).
 *
 * Vaults живут в памяти модуля — в renderer-процессе. На диск НЕ сохраняем.
 */
import { PiiVault } from "./masker"

const vaults = new Map<string, PiiVault>()

export function getOrCreateVault(sessionId: string): PiiVault {
  let v = vaults.get(sessionId)
  if (!v) {
    v = new PiiVault()
    vaults.set(sessionId, v)
  }
  return v
}

export function getVault(sessionId: string): PiiVault | undefined {
  return vaults.get(sessionId)
}

export function cleanupSession(sessionId: string): void {
  const v = vaults.get(sessionId)
  if (v) {
    v.clear()
    vaults.delete(sessionId)
  }
}

/** Очистить все vault'ы (при logout/выходе). */
export function cleanupAll(): void {
  for (const v of vaults.values()) v.clear()
  vaults.clear()
}
