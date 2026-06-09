/**
 * OurApp — модалка «Сменить тариф» (ТЗ-02 §5.3).
 *
 * Показывает сравнение трёх платных тарифов (Старт / Профи / Команда) и,
 * при выборе нового, считает что произойдёт:
 *   - UPGRADE (дороже текущего): пропорциональная доплата за остаток периода
 *     («До конца периода 18 дней, доплата 1 740 ₽»). Применяется сразу.
 *   - DOWNGRADE (дешевле): без возврата денег, вступит в силу с начала
 *     следующего периода (через subscriptions.pendingPlanCode на бэкенде).
 *
 * Расчёт доплаты дублирует серверную формулу (см. routes/subscriptions.ts):
 *   surcharge = (newPrice − currentPrice) × min(1, daysLeft / 30)
 * Это лишь предпросмотр — источник правды по сумме остаётся за бэкендом,
 * который при подтверждении вернёт фактический surchargeKopeck.
 *
 * Каталог тарифов дублируется локально (источник — billing/src/db/seed.ts),
 * т.к. отдельного эндпоинта каталога нет. Цены — в копейках, как в БД.
 */
import { createMemo, createSignal, For, Show, type Component } from "solid-js"
import { billingApi, daysUntil, formatRubles, type ChangePlanResponse } from "./billing-api"

export interface PlanInfo {
  code: string
  titleRu: string
  priceRubKopeck: number
  monthlyCredits: number
  tagline: string
  features: string[]
}

/** Платные тарифы для таблицы сравнения. Совпадает с seed-данными биллинга. */
export const PLAN_CATALOG: PlanInfo[] = [
  {
    code: "start",
    titleRu: "Старт",
    priceRubKopeck: 99000,
    monthlyCredits: 500,
    tagline: "Для частнопрактикующего юриста или бухгалтера",
    features: [
      "500 кредитов в месяц",
      "Claude Sonnet, Haiku, GigaChat",
      "Экспорт в Word и PDF",
      "Поддержка по email",
    ],
  },
  {
    code: "pro",
    titleRu: "Профи",
    priceRubKopeck: 290000,
    monthlyCredits: 1700,
    tagline: "Все топ-модели для активной работы",
    features: [
      "1 700 кредитов в месяц",
      "Топ-модели: Claude Opus, GPT",
      "Приоритетная обработка запросов",
      "История без ограничений",
    ],
  },
  {
    code: "team",
    titleRu: "Команда",
    priceRubKopeck: 990000,
    monthlyCredits: 7000,
    tagline: "Для юрфирм и бухгалтерских контор",
    features: [
      "7 000 кредитов в месяц",
      "До 5 рабочих мест",
      "Общая библиотека сценариев",
      "Выделенная поддержка",
    ],
  },
]

/** Цена тарифа в копейках, включая бесплатный (free/trial = 0). */
const PLAN_PRICE_KOPECK: Record<string, number> = {
  free: 0,
  start: 99000,
  pro: 290000,
  team: 990000,
}

function priceKopeck(code: string | null | undefined): number {
  if (!code) return 0
  return PLAN_PRICE_KOPECK[code] ?? 0
}

export interface PlanChangeModalProps {
  open: boolean
  /** Текущий тариф пользователя (включая 'free'). */
  currentPlanCode: string
  /** ISO-дата конца текущего периода — для расчёта пропорции. */
  currentPeriodEnd: string | null | undefined
  /** Привязана ли карта (для upgrade нужна оплата). */
  hasCard: boolean
  /** Предвыбранный тариф (например, из low-balance-guard). */
  initialTarget?: string | null
  onClose: () => void
  /** Колбэк после успешной смены — родитель обновляет /me, /limits, историю. */
  onChanged: (result: ChangePlanResponse) => void
}

type Kind = "current" | "upgrade" | "downgrade"

export const PlanChangeModal: Component<PlanChangeModalProps> = (props) => {
  const [selected, setSelected] = createSignal<string | null>(props.initialTarget ?? null)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const daysLeft = createMemo(() => daysUntil(props.currentPeriodEnd) ?? 0)
  const prorationRatio = createMemo(() => Math.min(1, daysLeft() / 30))

  /** Тип изменения относительно текущего тарифа. */
  const kindOf = (code: string): Kind => {
    if (code === props.currentPlanCode) return "current"
    return priceKopeck(code) > priceKopeck(props.currentPlanCode) ? "upgrade" : "downgrade"
  }

  /** Предполагаемая доплата (копейки) при upgrade на выбранный тариф. */
  const surchargeKopeck = createMemo(() => {
    const code = selected()
    if (!code || kindOf(code) !== "upgrade") return 0
    const delta = priceKopeck(code) - priceKopeck(props.currentPlanCode)
    return Math.round(delta * prorationRatio())
  })

  const selectedKind = createMemo<Kind | null>(() => {
    const code = selected()
    return code ? kindOf(code) : null
  })

  const effectiveDateLabel = createMemo(() => {
    if (!props.currentPeriodEnd) return "в начале следующего периода"
    return new Date(props.currentPeriodEnd).toLocaleDateString("ru", {
      day: "numeric",
      month: "long",
    })
  })

  const canConfirm = createMemo(() => {
    const k = selectedKind()
    if (!k || k === "current" || busy()) return false
    // Для upgrade нужна привязанная карта (доплата списывается сразу).
    if (k === "upgrade" && surchargeKopeck() > 0 && !props.hasCard) return false
    return true
  })

  const confirm = async () => {
    const code = selected()
    if (!code) return
    setBusy(true)
    setError(null)
    const res = await billingApi.changePlan(code)
    setBusy(false)
    if (res.ok) {
      props.onChanged(res.data)
      props.onClose()
    } else {
      setError(mapError(res.error))
    }
  }

  return (
    <Show when={props.open}>
      <div class="ourapp-planmodal__overlay" onClick={() => !busy() && props.onClose()}>
        <div
          class="ourapp-planmodal"
          role="dialog"
          aria-modal="true"
          aria-label="Сменить тариф"
          onClick={(e) => e.stopPropagation()}
        >
          <header class="ourapp-planmodal__head">
            <h2 class="ourapp-planmodal__title">Сменить тариф</h2>
            <button
              type="button"
              class="ourapp-planmodal__close"
              aria-label="Закрыть"
              onClick={() => !busy() && props.onClose()}
            >
              ✕
            </button>
          </header>

          <div class="ourapp-planmodal__grid">
            <For each={PLAN_CATALOG}>
              {(plan) => {
                const k = () => kindOf(plan.code)
                const isCurrent = () => k() === "current"
                const isSelected = () => selected() === plan.code
                return (
                  <button
                    type="button"
                    class="ourapp-planmodal__card"
                    classList={{
                      "ourapp-planmodal__card--current": isCurrent(),
                      "ourapp-planmodal__card--selected": isSelected(),
                    }}
                    disabled={isCurrent() || busy()}
                    onClick={() => setSelected(plan.code)}
                  >
                    <div class="ourapp-planmodal__cardHead">
                      <span class="ourapp-planmodal__cardName">{plan.titleRu}</span>
                      <Show when={isCurrent()}>
                        <span class="ourapp-planmodal__badge">текущий</span>
                      </Show>
                    </div>
                    <div class="ourapp-planmodal__price">
                      {formatRubles(plan.priceRubKopeck)}&nbsp;₽
                      <span class="ourapp-planmodal__priceMeta">/ мес</span>
                    </div>
                    <div class="ourapp-planmodal__tagline">{plan.tagline}</div>
                    <ul class="ourapp-planmodal__features">
                      <For each={plan.features}>
                        {(f) => <li class="ourapp-planmodal__feature">{f}</li>}
                      </For>
                    </ul>
                  </button>
                )
              }}
            </For>
          </div>

          {/* ===== Сводка изменения ===== */}
          <Show when={selectedKind() === "upgrade"}>
            <div class="ourapp-planmodal__summary ourapp-planmodal__summary--upgrade">
              <Show
                when={surchargeKopeck() > 0}
                fallback={<span>До конца периода менее суток — доплата не требуется.</span>}
              >
                <span>
                  До конца периода <strong>{daysLeft()} дн</strong> — доплата{" "}
                  <strong>{formatRubles(surchargeKopeck())}&nbsp;₽</strong>. Новый тариф
                  заработает сразу, кредиты начислим пропорционально.
                </span>
              </Show>
              <Show when={surchargeKopeck() > 0 && !props.hasCard}>
                <div class="ourapp-planmodal__warn">
                  Сначала привяжите карту на странице «Кредиты и подписка» — без неё доплату
                  не списать.
                </div>
              </Show>
            </div>
          </Show>

          <Show when={selectedKind() === "downgrade"}>
            <div class="ourapp-planmodal__summary">
              Тариф сменится с начала следующего периода — <strong>{effectiveDateLabel()}</strong>.
              Деньги за остаток текущего периода не возвращаются.
            </div>
          </Show>

          <Show when={error()}>
            <div class="ourapp-planmodal__error">{error()}</div>
          </Show>

          <footer class="ourapp-planmodal__foot">
            <button
              type="button"
              class="ourapp-btn ourapp-btn--ghost"
              disabled={busy()}
              onClick={() => props.onClose()}
            >
              Отмена
            </button>
            <button
              type="button"
              class="ourapp-btn ourapp-btn--primary"
              disabled={!canConfirm()}
              onClick={confirm}
            >
              {busy() ? "Обрабатываем…" : "Подтвердить"}
            </button>
          </footer>
        </div>
      </div>
    </Show>
  )
}

/** Человекочитаемые сообщения для кодов ошибок бэкенда. */
function mapError(code: string): string {
  switch (code) {
    case "no_card_attached":
      return "Карта не привязана — привяжите её, чтобы оплатить доплату."
    case "payment_failed":
      return "Не удалось списать доплату. Проверьте карту и попробуйте ещё раз."
    case "acquirer_error":
      return "Ошибка эквайринга. Повторите попытку позже."
    case "payments_not_configured":
      return "Платежи временно недоступны."
    case "same_plan":
      return "Это ваш текущий тариф."
    case "plan_not_found":
      return "Тариф не найден."
    default:
      return "Не удалось сменить тариф. Попробуйте позже."
  }
}
