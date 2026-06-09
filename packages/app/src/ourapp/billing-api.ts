/**
 * OurApp billing API — тонкий wrapper над /me, /limits, /credits/rates.
 *
 * Phase 1 (local-first): backend на http://localhost:3000.
 * Phase 2+: домен будет конфигурируем через env / electron-store.
 *
 * Все запросы возвращают `{ ok: true, data }` или `{ ok: false, error }`.
 * Никаких throw — UI должен грейсфул-фоллбек при недоступном сервере.
 */

import { getSessionToken } from "./auth-storage"

// 127.0.0.1, не localhost — Electron renderer на Windows иногда резолвит
// localhost в IPv6 (::1), а node-fetch/Hono слушают только IPv4. Жёстко привязываем
// к IPv4 чтобы избежать "Failed to fetch" на этой почве.
const BILLING_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.VITE_OURAPP_BILLING_URL) ||
  "http://127.0.0.1:3000"

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

// ===== In-memory cache (per renderer process) =====
//
// Уменьшает время открытия страниц где fetch повторяется (sidebar /limits,
// credits-page /limits + /me + /rates). TTL 60 сек — fresh enough для биллинга,
// который меняется по запросам пользователя или раз в месяц.
//
// Сбросить: cacheReset() — позже вызывать после credits-mutating операций.

interface CacheEntry {
  expiresAt: number
  value: ApiResult<unknown>
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

export function cacheReset(): void {
  cache.clear()
}

interface RequestOptions extends RequestInit {
  /** Кастомный timeout в мс. По умолчанию 1500 (для фоновых GET, чтобы не блокировать UI). */
  timeoutMs?: number
  /** Отключить cache (для auth и mutations). */
  skipCache?: boolean
}

async function request<T>(path: string, opts?: RequestOptions): Promise<ApiResult<T>> {
  const cacheKey =
    !opts?.skipCache && (!opts?.method || opts.method === "GET") ? path : null
  if (cacheKey) {
    const hit = cache.get(cacheKey)
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as ApiResult<T>
    }
  }

  try {
    // Default: 1.5 сек для фоновых GET. Для пользовательских действий (auth) — больше.
    const ttl = opts?.timeoutMs ?? 1500
    const abort = AbortSignal.timeout ? AbortSignal.timeout(ttl) : undefined
    const token = getSessionToken()
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const { timeoutMs: _ignored, skipCache: _ignored2, ...fetchInit } = opts ?? {}
    void _ignored
    void _ignored2
    const res = await fetch(`${BILLING_BASE_URL}${path}`, {
      // Намеренно НЕ credentials:include — auth через Bearer JWT в Authorization header.
      // Electron main process перетирает Access-Control-Allow-Origin на "*",
      // что несовместимо с credentials:include (CORS spec).
      signal: abort,
      headers: {
        Accept: "application/json",
        ...authHeader,
        ...(fetchInit.headers ?? {}),
      },
      ...fetchInit,
    })
    const text = await res.text()
    const parsed = text ? safeJson(text) : null
    let result: ApiResult<T>
    if (!res.ok) {
      const errorMsg =
        parsed && typeof parsed === "object" && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : `HTTP ${res.status}`
      result = {
        ok: false,
        status: res.status,
        error: errorMsg,
      }
    } else {
      result = { ok: true, data: parsed as T }
    }
    if (cacheKey) {
      cache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS })
    }
    return result
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ===== Endpoints =====

export interface MeResponse {
  user: { id: string; email: string; name: string | null; primaryVertical: string | null }
  subscription: {
    id: string
    planCode: string
    status: string
    currentPeriodEnd: string
    trialEndsAt: string | null
    pendingPlanCode: string | null
    litellmKey: string | null
  } | null
  paymentMethod: { id: string; cardLast4: string | null; cardBrand: string | null } | null
  plan: {
    code: string
    titleRu: string
    monthlyCredits: number
    monthlyTasksTarget: number
    allowedModels: string[]
  } | null
  gateway: { baseUrl: string }
}

export interface LimitsResponse {
  credits: {
    remaining: number
    monthlyTotal: number
    breakdown: {
      subscription: { remaining: number; total: number }
      topup: { remaining: number; total: number }
      bonus: { remaining: number }
    }
  }
  plan: { code: string; titleRu: string }
  period: { currentPeriodEnd: string }
  status: { subscription: string; gatewayBlocked: boolean }
  gateway: { usedUsd: number; budgetUsd: number; blocked: boolean } | null
}

export interface RatesResponse {
  tiers: {
    lite: { label: string; description: string; models: ModelOption[] }
    mid: { label: string; description: string; models: ModelOption[] }
    top: { label: string; description: string; models: ModelOption[] }
  }
  calibration: { tokensPerCredit: { input: number; output: number }; note: string }
}

export interface ModelOption {
  code: string
  nameRu: string
  provider: string
  multiplier: string
}

export interface VerifyResponse {
  token: string
  user: { id: string; email: string }
}

// ===== Payments (ТЗ-02) =====

export interface AttachCardResponse {
  id: string
  cardLast4: string | null
  cardBrand: string | null
}

export interface TopupResponse {
  paymentId: string
  creditsAdded: number
  newBalance: number
}

export type PaymentStatus = "pending" | "success" | "failed" | "refunded"
export type PaymentKind = "subscription" | "topup" | "refund"

export interface PaymentHistoryItem {
  id: string
  amountKopeck: number
  status: PaymentStatus
  kind: PaymentKind
  planTitleRu: string | null
  creditsAdded: number | null
  failureReason: string | null
  paidAt: string | null
  createdAt: string
}

export interface PaymentHistoryResponse {
  items: PaymentHistoryItem[]
  total: number
}

export type ChangePlanResponse =
  | { status: "upgraded"; newPlanCode: string; surchargeKopeck: number; extraCredits: number }
  | { status: "downgrade_scheduled"; newPlanCode: string; effectiveAt: string }

export const billingApi = {
  me: () => request<MeResponse>("/me"),
  limits: () => request<LimitsResponse>("/limits"),
  rates: () => request<RatesResponse>("/credits/rates"),
  preview: (modelCode: string, inputTokens?: number, outputTokens?: number) =>
    request<{ modelCode: string; tier: string; multiplier: string; estimate: { credits: number } }>(
      "/credits/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelCode, inputTokens, outputTokens }),
        timeoutMs: 3_000,
        skipCache: true,
      },
    ),

  // ===== Auth =====
  // timeout 10 сек — пользователь кликнул кнопку, готов ждать. Cold-start
  // bun + SMTP queue могут дать 2-3 сек на холодный запрос.
  requestMagicLink: (email: string) =>
    request<null>("/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      timeoutMs: 10_000,
      skipCache: true,
    }),

  /**
   * Войти по 6-значному коду из email.
   * Единственный способ авторизации desktop-приложения.
   */
  verifyOtp: (email: string, code: string) =>
    request<VerifyResponse>(`/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
      timeoutMs: 10_000,
      skipCache: true,
    }),

  // ===== Payments (ТЗ-02) =====

  /** Привязать карту по cryptogram из CloudPayments Widget. */
  attachCard: (cryptogram: string) =>
    request<AttachCardResponse>("/payments/method", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cryptogram }),
      timeoutMs: 20_000, // эквайринг + 3DS, ждём дольше
      skipCache: true,
    }),

  /** Разовая докупка пакета кредитов ("p500" | "p1000" | "p2000"). */
  topup: (packageCode: string) =>
    request<TopupResponse>("/payments/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: packageCode }),
      timeoutMs: 20_000,
      skipCache: true,
    }),

  /** История платежей пользователя. */
  paymentHistory: () => request<PaymentHistoryResponse>("/payments/history", { skipCache: true }),

  /** Сменить тариф (upgrade с доплатой / downgrade с начала след. периода). */
  changePlan: (newPlanCode: string) =>
    request<ChangePlanResponse>("/subscriptions/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPlanCode }),
      timeoutMs: 20_000,
      skipCache: true,
    }),
}

/**
 * Расчёт «N дней до сброса» из ISO-даты периода.
 */
export function daysUntil(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const target = new Date(iso).getTime()
  const now = Date.now()
  const ms = target - now
  if (Number.isNaN(ms)) return undefined
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

/** Копейки → «1 290» (без знака валюты). */
export function formatRubles(amountKopeck: number): string {
  return (Math.round(amountKopeck) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/**
 * Сигнал «баланс/подписка изменились» — сбрасывает кэш и оповещает слушателей
 * (сайдбар-виджет /limits, страница /credits), чтобы они перезапросили данные.
 */
export const CREDITS_CHANGED_EVENT = "ourapp:credits-changed"

export function notifyCreditsChanged(): void {
  cacheReset()
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CREDITS_CHANGED_EVENT))
  }
}
