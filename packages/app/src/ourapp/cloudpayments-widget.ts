/**
 * OurApp — обёртка над CloudPayments Widget.
 *
 * Скрипт виджета (widget.cloudpayments.ru) подключаем динамически (script
 * injection), а НЕ через index.html: desktop-сборка работает офлайн/из file://,
 * и тянуть внешний скрипт нужно только в момент, когда пользователь реально
 * открывает оплату.
 *
 * Поток привязки карты:
 *   1. Грузим скрипт виджета (один раз, с кэшем промиса).
 *   2. Открываем модалку CloudPayments для ввода карты (с 3DS).
 *   3. Виджет отдаёт cryptogram — шифрованные данные карты.
 *   4. Cryptogram уходит на backend POST /payments/method, который делает
 *      cards/auth на 1 ₽ + void и сохраняет рекуррентный токен.
 *
 * ВАЖНО: cryptogram — чувствительные данные. Не логируем, не сохраняем локально,
 * сразу передаём на backend и забываем.
 */

const WIDGET_SRC = "https://widget.cloudpayments.ru/bundles/cloudpayments.js"

declare global {
  interface Window {
    // Глобальный объект, который инициализирует скрипт виджета.
    cp?: {
      CloudPayments: new () => {
        charge: (
          options: Record<string, unknown>,
          onSuccess: (options: { cryptogram?: string }) => void,
          onFail: (reason?: unknown) => void,
        ) => void
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

/** Public ID берём из env (Vite). В dev может быть пустым — тогда виджет не откроется. */
function getPublicId(): string {
  const env = (import.meta as { env?: Record<string, string> }).env
  return env?.VITE_CLOUDPAYMENTS_PUBLIC_ID ?? ""
}

/** Динамически подгрузить скрипт виджета. Идемпотентно (кэш промиса). */
export function loadCloudPaymentsScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if (window.cp) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    // Если скрипт уже в DOM (например, повторный вызов) — дождёмся load.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("widget script failed")))
      if (window.cp) resolve()
      return
    }
    const el = document.createElement("script")
    el.src = WIDGET_SRC
    el.async = true
    el.addEventListener("load", () => resolve())
    el.addEventListener("error", () => {
      scriptPromise = null // позволяем повторную попытку
      reject(new Error("Не удалось загрузить виджет CloudPayments"))
    })
    document.head.appendChild(el)
  })
  return scriptPromise
}

export interface CardBindingResult {
  cryptogram: string
}

/**
 * Открыть модалку CloudPayments для привязки карты.
 * @returns cryptogram при успехе, либо null если пользователь закрыл окно/отказ.
 */
export async function openCardBindingWidget(): Promise<CardBindingResult | null> {
  const publicId = getPublicId()
  if (!publicId) {
    throw new Error("VITE_CLOUDPAYMENTS_PUBLIC_ID не задан")
  }

  await loadCloudPaymentsScript()
  if (!window.cp) {
    throw new Error("Виджет CloudPayments недоступен")
  }

  return new Promise<CardBindingResult | null>((resolve) => {
    const widget = new window.cp!.CloudPayments()
    widget.charge(
      {
        publicId,
        description: "Привязка карты для «Параграфа»",
        amount: 1, // тестовое списание 1 ₽ (backend сразу делает void)
        currency: "RUB",
        requireEmail: false,
        skin: "mini",
      },
      (options) => {
        if (options?.cryptogram) {
          resolve({ cryptogram: options.cryptogram })
        } else {
          resolve(null)
        }
      },
      () => resolve(null),
    )
  })
}

/** Доступна ли оплата в текущей сборке (есть ли public id). */
export function isPaymentsConfigured(): boolean {
  return getPublicId().length > 0
}
