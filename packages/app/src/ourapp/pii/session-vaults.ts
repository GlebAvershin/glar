/**
 * OurApp — per-session PII vaults (ТЗ-04 §6; персист для веба — 2026-06-23).
 *
 * Vault хранит маппинг плейсхолдер→оригинал для сессии: маскирование при отправке
 * и демаскирование при отображении используют один и тот же словарь.
 *
 * ВЕБ: vault ПЕРСИСТИТСЯ в localStorage (ключ `ourapp.pii.vault.<sessionID>`), чтобы
 * демаскирование переживало перезагрузку страницы (на desktop был только in-memory).
 * Хранится под СИНХРОННЫМ шифром, ключ выводится из session-JWT — это «session-bound
 * obfuscation»: НЕ строгая криптография (ключ всё равно лежит на клиенте рядом, в том же
 * localStorage), но (а) не плейнтекст в devtools, (б) при новом логине старый JWT → другой
 * ключ → старые vault'ы не расшифровываются и считаются мусором. Реальные ПДн остаются
 * на машине пользователя (152-ФЗ: за рубеж/на сервер не уходят). Синхронность важна:
 * демаскирование при рендере (window.ourappUnmask) синхронно, поэтому на перезагрузке
 * vault'ы должны подняться в память синхронно ДО первого рендера (async-AES создавал бы
 * гонку → плейсхолдеры мелькали бы). Поэтому свой sync-шифр, а не crypto.subtle (async).
 */
import { PiiVault, type PiiVaultState } from "./masker"
import { getSessionToken } from "../auth-storage"

const STORAGE_PREFIX = "ourapp.pii.vault."

const vaults = new Map<string, PiiVault>()

// === Синхронный шифр (keystream XOR, ключ из JWT) =========================
// cyrb53 — быстрый sync-хэш строки в 53-битное число (хорошее распределение).
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Сид шифра выводим из СТАБИЛЬНОГО per-user значения — claim `sub` (id юзера) из JWT,
// а НЕ из всего токена: токен меняется при каждом логине (новые iat/exp), и если
// ключ зависит от него, повторный вход → другой ключ → старые vault'ы не читаются и
// стираются (юзер теряет демаскирование истории). `sub` стабилен между логинами того
// же юзера; у другого юзера другой sub → его vault'ы не читаются (гигиена сохранена).
function userKeySeed(): string {
  const jwt = getSessionToken()
  if (!jwt) return "ourapp-anon"
  try {
    const payload = jwt.split(".")[1]
    if (!payload) return "ourapp-anon"
    const json = JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))))) as {
      sub?: unknown
    }
    return typeof json.sub === "string" && json.sub ? `sub:${json.sub}` : "ourapp-anon"
  } catch {
    return "ourapp-anon"
  }
}

function cipherKey(): number {
  return cyrb53(userKeySeed(), 0x9e3779b1) >>> 0
}

function xorBytes(bytes: Uint8Array, seed: number): Uint8Array {
  const rnd = mulberry32(seed)
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i]! ^ Math.floor(rnd() * 256)
  return out
}

function encrypt(json: string): string {
  const bytes = new TextEncoder().encode(json)
  const x = xorBytes(bytes, cipherKey())
  let bin = ""
  for (const b of x) bin += String.fromCharCode(b)
  return btoa(bin)
}

function decrypt(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const x = xorBytes(bytes, cipherKey())
  return new TextDecoder().decode(x)
}

// === Персист ==============================================================
function storageKey(sessionId: string): string {
  return STORAGE_PREFIX + sessionId
}

function persist(sessionId: string, vault: PiiVault): void {
  try {
    if (vault.size === 0) {
      localStorage.removeItem(storageKey(sessionId))
      return
    }
    localStorage.setItem(storageKey(sessionId), encrypt(JSON.stringify(vault.toState())))
  } catch {
    // localStorage недоступен/переполнен — деградируем до in-memory.
  }
}

function loadFromStorage(sessionId: string): PiiVault | undefined {
  try {
    const raw = localStorage.getItem(storageKey(sessionId))
    if (!raw) return undefined
    const state = JSON.parse(decrypt(raw)) as PiiVaultState
    if (!state || !Array.isArray(state.map)) return undefined
    const v = new PiiVault(() => persist(sessionId, v))
    v.restore(state)
    return v
  } catch {
    // Чужой ключ (старый логин) / повреждённые данные → выкидываем.
    try {
      localStorage.removeItem(storageKey(sessionId))
    } catch {}
    return undefined
  }
}

// Синхронная загрузка всех персистнутых vault'ов в память при инициализации модуля —
// чтобы window.ourappUnmask (sync) видел их сразу после перезагрузки.
function loadAll(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue
      const sessionId = key.slice(STORAGE_PREFIX.length)
      if (vaults.has(sessionId)) continue
      const v = loadFromStorage(sessionId)
      if (v) vaults.set(sessionId, v)
    }
  } catch {
    // нет localStorage (SSR/тест) — пропускаем
  }
}
if (typeof localStorage !== "undefined") loadAll()

// === API ==================================================================
export function getOrCreateVault(sessionId: string): PiiVault {
  let v = vaults.get(sessionId)
  if (!v) {
    v = loadFromStorage(sessionId) ?? new PiiVault(() => persist(sessionId, vaults.get(sessionId)!))
    // у загруженного vault onMutate уже выставлен на этот sessionId
    if (!v.onMutate) v.onMutate = () => persist(sessionId, v!)
    vaults.set(sessionId, v)
  }
  return v
}

export function getVault(sessionId: string): PiiVault | undefined {
  let v = vaults.get(sessionId)
  if (!v) {
    v = loadFromStorage(sessionId)
    if (v) vaults.set(sessionId, v)
  }
  return v
}

/**
 * Демаскировать текст по vault'у конкретной сессии; если sessionId не задан (баг
 * рендера на вебе — message.sessionID иногда пуст) — пробуем по ВСЕМ загруженным
 * vault'ам. Плейсхолдеры уникальны как строки, поэтому подмена безопасна.
 */
export function unmaskWithFallback(text: string, sessionId?: string): string {
  if (!text || !text.includes("__PII_")) return text
  if (sessionId) {
    const v = getVault(sessionId)
    if (v && v.size > 0) return v.unmask(text)
  }
  let out = text
  for (const v of vaults.values()) {
    if (v.size > 0) out = v.unmask(out)
    if (!out.includes("__PII_")) break
  }
  return out
}

export function cleanupSession(sessionId: string): void {
  const v = vaults.get(sessionId)
  if (v) {
    v.clear()
    vaults.delete(sessionId)
  }
  try {
    localStorage.removeItem(storageKey(sessionId))
  } catch {}
}

/** Очистить все vault'ы (при logout/выходе) — и память, и localStorage. */
export function cleanupAll(): void {
  for (const v of vaults.values()) v.clear()
  vaults.clear()
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    for (const k of keys) localStorage.removeItem(k)
  } catch {}
}
