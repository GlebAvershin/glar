/**
 * OurApp — клиент к /usage/* (ТЗ-05 §7).
 *
 * Использует тот же request<T>-паттерн что billing-api.ts. Кеш на 60с — для
 * /usage/summary это безопасно, /usage/events — без кеша (юзер обновляет сам).
 */
import { getSessionToken } from "./auth-storage"

const BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_OURAPP_BILLING_URL) ||
  "http://127.0.0.1:3000"

export interface UsageSummary {
  range: { from: string; to: string }
  totalCredits: number
  totalRequests: number
  avgCreditsPerRequest: number
  byDay: Array<{ day: string; credits: number; requests: number }>
  byModel: Array<{ model: string; credits: number; requests: number }>
  byScenario: Array<{ scenarioId: string; credits: number; requests: number }>
}

export interface UsageEventItem {
  id: number
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  creditsCharged: number
  scenarioId: string | null
  status: string
  createdAt: string
}

export interface UsageEventsResponse {
  items: UsageEventItem[]
  range: { from: string; to: string }
  pagination: { limit: number; offset: number }
}

export type UsageResult<T> = { ok: true; data: T } | { ok: false; error: string }

async function request<T>(path: string): Promise<UsageResult<T>> {
  const token = getSessionToken()
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout?.(8000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: text || `HTTP ${res.status}` }
    }
    return { ok: true, data: (await res.json()) as T }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" }
  }
}

const isoDate = (d: Date) => d.toISOString()

export const usageApi = {
  summary: (from: Date, to: Date) =>
    request<UsageSummary>(`/usage/summary?from=${isoDate(from)}&to=${isoDate(to)}`),

  events: (from: Date, to: Date, limit = 100, offset = 0) =>
    request<UsageEventsResponse>(
      `/usage/events?from=${isoDate(from)}&to=${isoDate(to)}&limit=${limit}&offset=${offset}`,
    ),

  /** Триггерит браузерное скачивание CSV. Возвращает true при успехе. */
  exportCsv: async (from: Date, to: Date): Promise<boolean> => {
    const token = getSessionToken()
    try {
      const res = await fetch(
        `${BASE_URL}/usage/export.csv?from=${isoDate(from)}&to=${isoDate(to)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) return false
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `usage-${isoDate(from).slice(0, 10)}_${isoDate(to).slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return true
    } catch {
      return false
    }
  },
}

/** Хелпер: предустановленные периоды для select'а. */
export type UsagePeriod = "week" | "month" | "year"

export function periodRange(period: UsagePeriod): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date(to)
  if (period === "week") from.setDate(from.getDate() - 7)
  else if (period === "month") from.setMonth(from.getMonth() - 1)
  else from.setFullYear(from.getFullYear() - 1)
  return { from, to }
}
