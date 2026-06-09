/**
 * OurApp welcome-сайдбар (левая колонка в новой сессии).
 *
 * Соответствует mockup 01 в design/preview.html:
 *   <Brand>           ← «Параграф» серифом + роль («Юрист»)
 *   <Section> Сценарии  ← список с активным
 *   <Section> История   ← последние сессии
 *   <UsageCard>       ← кредиты в этом месяце (главный индикатор)
 *
 * Кликаемые элементы — proof-of-concept (фокус на визуале). Привязка к
 * реальной session-list, кредитному API и роутеру — следующая итерация.
 */
import { createMemo, createResource, For, type Component } from "solid-js"
import { scenariosFor, type Scenario } from "./scenarios"
import { billingApi, daysUntil } from "./billing-api"

export interface WelcomeSidebarRecentSession {
  id: string
  title: string
  /** Опциональный subtitle (имя проекта, относительная дата). */
  subtitle?: string
}

export interface WelcomeSidebarProps {
  /** Текущая вертикаль для подбора сценариев в списке. */
  vertical: "lawyer" | "accountant"
  /** Колбэк при клике на сценарий — диспатчит scenario-pick. */
  onPickScenario?: (s: Scenario) => void
  /** Стат кредитов (если не передано — показывается -/-, без падения). */
  credits?: {
    remaining: number
    total: number
    planTitle: string
    resetInDays?: number
  }
  /** Если задано — рисует кнопку «Настройки» под индикатором кредитов. */
  onOpenSettings?: () => void
  /** Если задано — рисует кнопку «Помощь». */
  onOpenHelp?: () => void
  /** Если задано — рисует кнопку «История». */
  onOpenHistory?: () => void
  /** Если задано — рисует кнопку «Аналитика». */
  onOpenAnalytics?: () => void
  /** Если задано — клик по карточке кредитов ведёт на /credits. */
  onOpenCredits?: () => void
  /** Реальные недавние сессии. Если undefined — секция «История» скрыта. */
  recentSessions?: WelcomeSidebarRecentSession[]
  /** Колбэк по клику на сессию из «История». */
  onOpenSession?: (session: WelcomeSidebarRecentSession) => void
  /** ID активной сессии (для подсветки). */
  activeSessionId?: string
}


export const WelcomeSidebar: Component<WelcomeSidebarProps> = (props) => {
  // Показываем все сценарии вертикали (их 7) — лимит .slice(0,5) скрывал новые.
  const list = createMemo(() => scenariosFor(props.vertical))
  const verticalLabel = () => (props.vertical === "lawyer" ? "Юрист" : "Бухгалтер")

  // Авто-fetch /limits если props.credits не передан явно.
  // Грейсфул: если billing-сервер недоступен — fallback на «— / —».
  const [fetched] = createResource(async () => {
    if (props.credits) return null // не fetch'им если родитель уже передал
    const res = await billingApi.limits()
    if (!res.ok) return null
    return res.data
  })

  const credits = () => {
    if (props.credits) return props.credits
    const d = fetched()
    if (!d) return undefined
    return {
      remaining: d.credits.remaining,
      total: d.credits.monthlyTotal,
      planTitle: `«${d.plan.titleRu}»`,
      resetInDays: daysUntil(d.period.currentPeriodEnd),
    }
  }

  const pct = () => {
    const c = credits()
    if (!c || c.total <= 0) return 0
    return Math.min(100, Math.round((c.remaining / c.total) * 100))
  }

  return (
    <aside class="ourapp-sidebar">
      <div class="ourapp-sidebar__header">
        <div class="ourapp-sidebar__brand">Параграф</div>
        <div class="ourapp-sidebar__role">{verticalLabel()}</div>
      </div>

      <div class="ourapp-sidebar__section">
        <div class="ourapp-sidebar__label">Сценарии</div>
        <For each={list()}>
          {(s, i) => (
            <button
              type="button"
              class="ourapp-sidebar__item"
              classList={{ "ourapp-sidebar__item--active": i() === 0 }}
              onClick={() => props.onPickScenario?.(s)}
              title={s.lede}
            >
              <span class="ourapp-sidebar__dot" />
              <span class="ourapp-sidebar__item-text">{s.title}</span>
            </button>
          )}
        </For>
      </div>

      {props.recentSessions && props.recentSessions.length > 0 && (
        <div class="ourapp-sidebar__section">
          <div class="ourapp-sidebar__label">История</div>
          <For each={props.recentSessions}>
            {(session) => (
              <button
                type="button"
                class="ourapp-sidebar__item"
                classList={{
                  "ourapp-sidebar__item--active": session.id === props.activeSessionId,
                }}
                onClick={() => props.onOpenSession?.(session)}
                title={session.subtitle ?? session.title}
              >
                <span class="ourapp-sidebar__dot" />
                <span class="ourapp-sidebar__item-text">{session.title}</span>
              </button>
            )}
          </For>
        </div>
      )}

      <div class="ourapp-sidebar__footer">
        <button
          type="button"
          class="ourapp-usage ourapp-usage--button"
          onClick={() => props.onOpenCredits?.()}
          disabled={!props.onOpenCredits}
        >
          <div class="ourapp-usage__head">
            <span>Кредиты в этом месяце</span>
            <span class="ourapp-usage__numbers">
              {credits() ? (
                <>
                  <strong>{credits()!.remaining.toLocaleString("ru")}</strong>
                  {" / "}
                  {credits()!.total.toLocaleString("ru")}
                </>
              ) : (
                <span class="ourapp-usage__pending">— / —</span>
              )}
            </span>
          </div>
          <div class="ourapp-usage__bar" aria-hidden="true">
            <div class="ourapp-usage__fill" style={{ width: `${pct()}%` }} />
          </div>
          <div class="ourapp-usage__meta">
            {credits()
              ? `${credits()!.planTitle}${
                  credits()!.resetInDays !== undefined ? ` · сброс через ${credits()!.resetInDays} дн` : ""
                }`
              : fetched.loading
                ? "Загрузка тарифа…"
                : "Тариф недоступен"}
          </div>
        </button>

        {(props.onOpenSettings || props.onOpenHelp || props.onOpenHistory || props.onOpenAnalytics) && (
          <div class="ourapp-sidebar__nav">
            {props.onOpenHistory && (
              <button type="button" class="ourapp-sidebar__navitem" onClick={props.onOpenHistory}>
                <span class="ourapp-sidebar__navicon" aria-hidden="true">
                  🗂
                </span>
                История
              </button>
            )}
            {props.onOpenAnalytics && (
              <button type="button" class="ourapp-sidebar__navitem" onClick={props.onOpenAnalytics}>
                <span class="ourapp-sidebar__navicon" aria-hidden="true">
                  📊
                </span>
                Аналитика
              </button>
            )}
            {props.onOpenSettings && (
              <button type="button" class="ourapp-sidebar__navitem" onClick={props.onOpenSettings}>
                <span class="ourapp-sidebar__navicon" aria-hidden="true">
                  ⚙
                </span>
                Настройки
              </button>
            )}
            {props.onOpenHelp && (
              <button type="button" class="ourapp-sidebar__navitem" onClick={props.onOpenHelp}>
                <span class="ourapp-sidebar__navicon" aria-hidden="true">
                  ?
                </span>
                Помощь
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
