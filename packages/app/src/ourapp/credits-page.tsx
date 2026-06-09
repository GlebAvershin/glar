/**
 * OurApp — страница «Кредиты и подписка» (ТЗ-02 §5.2, §5.4).
 *
 * Layout:
 *   ┌────────────────────────────────┐
 *   │ Подписка «Профи» — активна … │  ← заголовок-серифом
 *   ├──────────────────┬─────────────┤
 *   │ Баланс кредитов  │ Подписка    │  ← двух-колоночная сетка
 *   │ 1 173 / 1 700    │ Тариф/карта │
 *   │ progressbar      │ след. списан│
 *   │ Цена модели      │             │
 *   │ [CTA: Докупить]  │             │
 *   ├──────────────────┴─────────────┤
 *   │ История платежей (таблица)     │
 *   └────────────────────────────────┘
 *
 * Кнопки подключены к billing-api:
 *   - «Докупить +500» → при отсутствии карты сначала виджет привязки, затем topup.
 *   - «Сменить тариф» → модалка сравнения тарифов (plan-change-modal).
 * История платежей — реальный fetch /payments/history.
 *
 * Query-параметр ?focus=topup|plans (из low-balance-guard) автозапускает
 * соответствующее действие при открытии страницы.
 */
import { createMemo, createResource, createSignal, For, onMount, Show, type Component } from "solid-js"
import { useSearchParams } from "@solidjs/router"
import {
  billingApi,
  daysUntil,
  formatRubles,
  notifyCreditsChanged,
  type PaymentHistoryItem,
  type PaymentStatus,
} from "./billing-api"
import { openCardBindingWidget, isPaymentsConfigured } from "./cloudpayments-widget"
import { PlanChangeModal } from "./plan-change-modal"

const TOPUP_PACKAGE = "p500"

interface Notice {
  kind: "ok" | "error"
  text: string
}

export const CreditsPage: Component<{ onClose?: () => void }> = (props) => {
  const [searchParams] = useSearchParams<{ focus?: string }>()

  const [limits, { refetch: refetchLimits }] = createResource(() =>
    billingApi.limits().then((r) => (r.ok ? r.data : null)),
  )
  const [rates] = createResource(() => billingApi.rates().then((r) => (r.ok ? r.data : null)))
  const [me, { refetch: refetchMe }] = createResource(() =>
    billingApi.me().then((r) => (r.ok ? r.data : null)),
  )
  const [history, { refetch: refetchHistory }] = createResource(() =>
    billingApi.paymentHistory().then((r) => (r.ok ? r.data : null)),
  )

  const [busy, setBusy] = createSignal(false)
  const [notice, setNotice] = createSignal<Notice | null>(null)
  const [planModalOpen, setPlanModalOpen] = createSignal(false)
  // Фильтр истории по статусу: "all" | PaymentStatus.
  const [historyFilter, setHistoryFilter] = createSignal<"all" | PaymentStatus>("all")

  const remaining = () => limits()?.credits.remaining ?? 0
  const total = () => limits()?.credits.monthlyTotal ?? 0
  const pct = () => {
    if (!limits() || total() <= 0) return 0
    return Math.min(100, Math.round((remaining() / total()) * 100))
  }
  const usedPct = () => Math.max(0, 100 - pct())
  const resetIn = () => daysUntil(limits()?.period.currentPeriodEnd)
  const planTitle = () => limits()?.plan.titleRu ?? me()?.plan?.titleRu ?? "—"
  const priceLabel = () => {
    const code = me()?.plan?.code
    if (code === "free") return "Бесплатно"
    if (code === "start") return "990 ₽ / мес"
    if (code === "pro") return "2 900 ₽ / мес"
    if (code === "team") return "9 900 ₽ / мес"
    return "—"
  }

  const card = () => me()?.paymentMethod ?? null
  const cardLabel = createMemo(() => {
    const c = card()
    if (!c) return "Не привязана"
    const brand = c.cardBrand ? brandTitle(c.cardBrand) : "Карта"
    return c.cardLast4 ? `${brand} •••• ${c.cardLast4}` : brand
  })

  /** Платежи после применения фильтра по статусу. */
  const filteredHistory = createMemo<PaymentHistoryItem[]>(() => {
    const items = history()?.items ?? []
    const f = historyFilter()
    return f === "all" ? items : items.filter((i) => i.status === f)
  })

  /** Перечитать все денежные данные после операции + оповестить сайдбар. */
  const refreshAll = async () => {
    notifyCreditsChanged() // сбрасывает кэш billing-api и шлёт событие сайдбару
    await Promise.all([refetchLimits(), refetchMe(), refetchHistory()])
  }

  // ===== Докупка кредитов =====
  const handleTopup = async () => {
    if (busy()) return
    setNotice(null)

    if (!isPaymentsConfigured()) {
      setNotice({ kind: "error", text: "Оплата не настроена в этой сборке." })
      return
    }

    try {
      // Нет карты — сначала привязка через виджет CloudPayments (с 3DS).
      if (!card()) {
        const bound = await openCardBindingWidget()
        if (!bound) return // пользователь закрыл окно
        setBusy(true)
        const attach = await billingApi.attachCard(bound.cryptogram)
        if (!attach.ok) {
          setBusy(false)
          setNotice({ kind: "error", text: cardError(attach.error) })
          return
        }
        await refetchMe()
      }

      setBusy(true)
      const res = await billingApi.topup(TOPUP_PACKAGE)
      setBusy(false)

      if (res.ok) {
        await refreshAll()
        setNotice({
          kind: "ok",
          text: `Платёж прошёл. +${res.data.creditsAdded} кредитов. Баланс: ${res.data.newBalance.toLocaleString("ru")}.`,
        })
      } else {
        setNotice({ kind: "error", text: topupError(res.error) })
      }
    } catch (err) {
      setBusy(false)
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Не удалось выполнить оплату.",
      })
    }
  }

  // ===== Смена тарифа =====
  const openPlanModal = () => {
    setNotice(null)
    setPlanModalOpen(true)
  }

  const handlePlanChanged = async (result: { status: string }) => {
    await refreshAll()
    setNotice(
      result.status === "upgraded"
        ? { kind: "ok", text: "Тариф изменён — новый план уже активен." }
        : { kind: "ok", text: "Смена тарифа запланирована на начало следующего периода." },
    )
  }

  // ===== Автозапуск по ?focus= из low-balance-guard =====
  onMount(() => {
    const focus = searchParams.focus
    if (focus === "topup") {
      void handleTopup()
    } else if (focus === "plans") {
      openPlanModal()
    }
  })

  return (
    <div class="ourapp-credits">
      <header class="ourapp-credits__topbar">
        <button type="button" class="ourapp-credits__back" onClick={props.onClose}>
          ← Назад
        </button>
        <div class="ourapp-credits__crumb">Профиль · Кредиты и подписка</div>
      </header>

      <main class="ourapp-credits__main">
        <h1 class="ourapp-credits__title">
          Подписка «<em>{planTitle()}</em>»
          <Show when={limits()}>
            {" — активна до "}
            <span class="ourapp-credits__date">
              {new Date(limits()!.period.currentPeriodEnd).toLocaleDateString("ru", {
                day: "numeric",
                month: "long",
              })}
            </span>
          </Show>
        </h1>

        <Show when={notice()}>
          {(n) => (
            <div
              class="ourapp-credits__notice"
              classList={{
                "ourapp-credits__notice--ok": n().kind === "ok",
                "ourapp-credits__notice--error": n().kind === "error",
              }}
            >
              <span>{n().text}</span>
              <button
                type="button"
                class="ourapp-credits__noticeClose"
                aria-label="Скрыть"
                onClick={() => setNotice(null)}
              >
                ✕
              </button>
            </div>
          )}
        </Show>

        <div class="ourapp-credits__grid">
          {/* ===== Баланс кредитов ===== */}
          <section class="ourapp-credits__card ourapp-credits__card--balance">
            <div class="ourapp-credits__label">Баланс кредитов</div>
            <div class="ourapp-credits__balance">
              <span class="ourapp-credits__balanceN">{remaining().toLocaleString("ru")}</span>
              <span class="ourapp-credits__balanceSub">
                /&nbsp;{total().toLocaleString("ru")} в&nbsp;этом месяце
              </span>
            </div>

            <div class="ourapp-credits__progress">
              <div class="ourapp-credits__progressBar">
                <div class="ourapp-credits__progressFill" style={{ width: `${100 - pct()}%` }} />
              </div>
              <div class="ourapp-credits__progressMeta">
                <span>
                  <strong>{usedPct()}%</strong> использовано
                </span>
                <Show when={resetIn() !== undefined}>
                  <span>
                    Сброс через <strong>{resetIn()} дн</strong>
                  </span>
                </Show>
              </div>
            </div>

            {/* ===== Цена модели ===== */}
            <div class="ourapp-credits__rates">
              <div class="ourapp-credits__ratesHead">Цена модели</div>
              <Show when={rates()} fallback={<div class="ourapp-credits__pending">Загрузка тарификации…</div>}>
                <For each={["lite", "mid", "top"] as const}>
                  {(tier) => {
                    const t = () => rates()!.tiers[tier]
                    const dotColor = () =>
                      tier === "lite" ? "#8B8680" : tier === "mid" ? "#0B5345" : "#C8A85C"
                    return (
                      <div class="ourapp-credits__rate">
                        <span class="ourapp-credits__rateDot" style={{ background: dotColor() }} />
                        <span class="ourapp-credits__rateName">
                          {t().models.map((m) => m.nameRu).join(", ") || t().label}
                        </span>
                        <span class="ourapp-credits__rateMult">
                          {t().models[0]?.multiplier ?? "—"}× кредит
                        </span>
                      </div>
                    )
                  }}
                </For>
                <div class="ourapp-credits__ratesFoot">{rates()!.calibration.note}</div>
              </Show>
            </div>

            <div class="ourapp-credits__actions">
              <button
                type="button"
                class="ourapp-btn ourapp-btn--primary"
                disabled={busy()}
                onClick={handleTopup}
              >
                {busy() ? "Обрабатываем…" : "Докупить +500 кредитов · 1\u00A0290\u00A0₽"}
              </button>
              <button
                type="button"
                class="ourapp-btn ourapp-btn--secondary"
                disabled={busy()}
                onClick={openPlanModal}
              >
                Сменить тариф
              </button>
            </div>
          </section>

          {/* ===== Подписка ===== */}
          <section class="ourapp-credits__card">
            <div class="ourapp-credits__label">Подписка</div>
            <div class="ourapp-credits__row">
              <span class="ourapp-credits__rowLabel">Тариф</span>
              <span class="ourapp-credits__rowValue">
                {planTitle()} — {total().toLocaleString("ru")} кредитов / мес
              </span>
            </div>
            <div class="ourapp-credits__row">
              <span class="ourapp-credits__rowLabel">Стоимость</span>
              <span class="ourapp-credits__rowValue">{priceLabel()}</span>
            </div>
            <div class="ourapp-credits__row">
              <span class="ourapp-credits__rowLabel">Следующее списание</span>
              <span class="ourapp-credits__rowValue">
                <Show when={limits()} fallback="—">
                  {new Date(limits()!.period.currentPeriodEnd).toLocaleDateString("ru", {
                    day: "numeric",
                    month: "long",
                  })}
                </Show>
              </span>
            </div>
            <div class="ourapp-credits__row">
              <span class="ourapp-credits__rowLabel">Карта</span>
              <span class="ourapp-credits__rowValue">{cardLabel()}</span>
            </div>
            <div class="ourapp-credits__row">
              <span class="ourapp-credits__rowLabel">Докупленные кредиты</span>
              <span class="ourapp-credits__rowValue">
                {limits()?.credits.breakdown.topup.remaining ?? 0}{" "}
                <span class="ourapp-credits__rowMeta">(не сгорают до конца след. месяца)</span>
              </span>
            </div>
          </section>
        </div>

        {/* ===== История платежей ===== */}
        <section class="ourapp-credits__card ourapp-credits__history">
          <div class="ourapp-credits__historyHead">
            <div class="ourapp-credits__label">История платежей</div>
            <Show when={history() && history()!.items.length > 0}>
              <div class="ourapp-credits__filter" role="group" aria-label="Фильтр по статусу">
                <For
                  each={
                    [
                      ["all", "Все"],
                      ["success", "Оплачено"],
                      ["failed", "Отклонён"],
                      ["pending", "В обработке"],
                    ] as const
                  }
                >
                  {([value, label]) => (
                    <button
                      type="button"
                      class="ourapp-credits__filterBtn"
                      classList={{ "ourapp-credits__filterBtn--active": historyFilter() === value }}
                      onClick={() => setHistoryFilter(value)}
                    >
                      {label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <Show
            when={history() && filteredHistory().length > 0}
            fallback={
              <div class="ourapp-credits__historyEmpty">
                <Show
                  when={history.loading}
                  fallback={
                    history() && history()!.items.length > 0
                      ? "Нет платежей с выбранным статусом."
                      : "Пока пусто. Первый платёж появится здесь после оплаты подписки или докупки."
                  }
                >
                  Загрузка…
                </Show>
              </div>
            }
          >
            <table class="ourapp-credits__table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Операция</th>
                  <th class="ourapp-credits__cellRight">Сумма</th>
                  <th class="ourapp-credits__cellRight">Кредиты</th>
                  <th class="ourapp-credits__cellRight">Статус</th>
                </tr>
              </thead>
              <tbody>
                <For each={filteredHistory()}>
                  {(item) => (
                    <tr>
                      <td>{formatHistoryDate(item)}</td>
                      <td>{operationLabel(item)}</td>
                      <td class="ourapp-credits__cellRight">{formatRubles(item.amountKopeck)}&nbsp;₽</td>
                      <td class="ourapp-credits__cellRight">
                        {item.creditsAdded != null ? `+${item.creditsAdded.toLocaleString("ru")}` : "—"}
                      </td>
                      <td class="ourapp-credits__cellRight">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </section>
      </main>

      <PlanChangeModal
        open={planModalOpen()}
        currentPlanCode={me()?.plan?.code ?? me()?.subscription?.planCode ?? "free"}
        currentPeriodEnd={limits()?.period.currentPeriodEnd ?? me()?.subscription?.currentPeriodEnd}
        hasCard={!!card()}
        onClose={() => setPlanModalOpen(false)}
        onChanged={handlePlanChanged}
      />
    </div>
  )
}

// ===== Хелперы отображения =====

function brandTitle(brand: string): string {
  switch (brand) {
    case "visa":
      return "Visa"
    case "mastercard":
      return "Mastercard"
    case "mir":
      return "Мир"
    case "maestro":
      return "Maestro"
    default:
      return "Карта"
  }
}

function formatHistoryDate(item: PaymentHistoryItem): string {
  const iso = item.paidAt ?? item.createdAt
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" })
}

function operationLabel(item: PaymentHistoryItem): string {
  if (item.kind === "subscription") {
    return item.planTitleRu ? `Подписка «${item.planTitleRu}»` : "Подписка"
  }
  if (item.kind === "topup") return "Докупка кредитов"
  if (item.kind === "refund") return "Возврат"
  return "Платёж"
}

const StatusBadge: Component<{ status: PaymentStatus }> = (props) => {
  const label = () => {
    switch (props.status) {
      case "success":
        return "Оплачено"
      case "failed":
        return "Отклонён"
      case "pending":
        return "В обработке"
      case "refunded":
        return "Возврат"
      default:
        return props.status
    }
  }
  return (
    <span
      class="ourapp-credits__badge"
      classList={{
        "ourapp-credits__badge--ok": props.status === "success",
        "ourapp-credits__badge--fail": props.status === "failed",
        "ourapp-credits__badge--pending": props.status === "pending",
        "ourapp-credits__badge--refund": props.status === "refunded",
      }}
    >
      {label()}
    </span>
  )
}

function cardError(code: string): string {
  switch (code) {
    case "card_declined":
      return "Карта не прошла проверку. Попробуйте другую."
    case "acquirer_error":
      return "Ошибка эквайринга при привязке карты. Повторите позже."
    case "payments_not_configured":
      return "Платежи временно недоступны."
    default:
      return "Не удалось привязать карту."
  }
}

function topupError(code: string): string {
  switch (code) {
    case "no_card_attached":
      return "Карта не привязана. Привяжите карту и повторите."
    case "payment_failed":
      return "Не удалось списать оплату. Проверьте карту и попробуйте ещё раз."
    case "acquirer_error":
      return "Ошибка эквайринга. Повторите попытку позже."
    case "payments_not_configured":
      return "Платежи временно недоступны."
    case "no_subscription":
      return "Активная подписка не найдена."
    default:
      return "Не удалось выполнить докупку."
  }
}
