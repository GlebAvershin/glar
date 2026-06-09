/**
 * OurApp Home — landing-page приложения.
 *
 * Отличается от NewSession (библиотека сценариев) тем, что:
 *   - НЕТ боковой панели — full-page по центру
 *   - Большой dramatic hero
 *   - Один primary CTA «Начать новую задачу»
 *   - Компактная секция «Продолжить работу» (если есть)
 *   - Лёгкая ссылка-доступ к настройкам/помощи в правом верхнем углу
 *
 * Цель: дать «дом» с одним очевидным действием. Библиотека сценариев — на /session.
 */
import { For, Show, type Component } from "solid-js"
import type { Vertical } from "./scenario-library"
import type { Scenario } from "./scenarios"

export interface HomeRecentSession {
  id: string
  title: string
  relativeAt: string
  subtitle?: string
  directory: string
}

export interface HomeWelcomeProps {
  vertical: Vertical
  recent: HomeRecentSession[]
  onOpenSession: (session: HomeRecentSession) => void
  onPickScenario: (s: Scenario) => void
  /** Начать новую задачу (основной CTA). */
  onStartNew: () => void
  onOpenSettings: () => void
  onOpenHelp: () => void
  /** Открыть страницу истории сессий. */
  onOpenHistory?: () => void
  /** Открыть страницу аналитики использования. */
  onOpenAnalytics?: () => void
  /** Открыть страницу «Кредиты и подписка». */
  onOpenCredits: () => void
  /** Сменить вертикаль — клик в шапке. */
  onVerticalChange: (v: Vertical) => void
}

export const HomeWelcome: Component<HomeWelcomeProps> = (props) => {
  const recentVisible = () => props.recent.slice(0, 4)
  const verticalLabel = () => (props.vertical === "lawyer" ? "Юрист" : "Бухгалтер")

  return (
    <div class="ourapp-landing">
      <header class="ourapp-landing__topbar">
        <div class="ourapp-landing__brand">
          <span class="ourapp-landing__brandname">Параграф</span>
          <button
            type="button"
            class="ourapp-landing__vertical"
            onClick={() => props.onVerticalChange(props.vertical === "lawyer" ? "accountant" : "lawyer")}
            title="Сменить профессию"
          >
            {verticalLabel()}
          </button>
        </div>
        <div class="ourapp-landing__nav">
          <button type="button" class="ourapp-landing__navbtn" onClick={props.onOpenCredits}>
            Кредиты
          </button>
          <button type="button" class="ourapp-landing__navbtn" onClick={props.onOpenSettings}>
            ⚙ Настройки
          </button>
          {props.onOpenHistory && (
            <button type="button" class="ourapp-landing__navbtn" onClick={props.onOpenHistory}>
              🗂 История
            </button>
          )}
          {props.onOpenAnalytics && (
            <button type="button" class="ourapp-landing__navbtn" onClick={props.onOpenAnalytics}>
              📊 Аналитика
            </button>
          )}
          <button type="button" class="ourapp-landing__navbtn" onClick={props.onOpenHelp}>
            Помощь
          </button>
        </div>
      </header>

      <main class="ourapp-landing__main">
        <div class="ourapp-landing__hero">
          <div class="ourapp-landing__eyebrow">
            Добро пожаловать в&nbsp;Параграф
            <span class="ourapp-landing__eyebrowdot" aria-hidden="true">·</span>
            <span class="ourapp-landing__eyebrowrole">{verticalLabel()}</span>
          </div>
          <h1 class="ourapp-landing__title">
            Серьёзный инструмент
            <br />
            <em>с тёплой подачей.</em>
          </h1>
          <p class="ourapp-landing__lede">
            {props.vertical === "lawyer"
              ? "Прочитает договор, найдёт риски, подготовит претензию. Не пустой чат — пошаговые сценарии под юриста."
              : "Проверит первичку, ответит на требование ФНС, объяснит норму НК. Не пустой чат — пошаговые сценарии под бухгалтера."}
          </p>

          <div class="ourapp-landing__actions">
            <button
              type="button"
              class="ourapp-landing__cta ourapp-landing__cta--primary"
              onClick={props.onStartNew}
            >
              Начать новую задачу&nbsp;→
            </button>
          </div>
        </div>

        <Show when={recentVisible().length > 0}>
          <aside class="ourapp-landing__recent">
            <div class="ourapp-landing__recenthead">
              <h2 class="ourapp-landing__recenttitle">Продолжить работу</h2>
              <span class="ourapp-landing__recentcount">
                {props.recent.length} {props.recent.length === 1 ? "сессия" : "сессий"}
              </span>
            </div>
            <ul class="ourapp-landing__recentlist">
              <For each={recentVisible()}>
                {(session) => (
                  <li>
                    <button
                      type="button"
                      class="ourapp-landing__recentitem"
                      onClick={() => props.onOpenSession(session)}
                    >
                      <div class="ourapp-landing__recentline">
                        <span class="ourapp-landing__recentdot" aria-hidden="true" />
                        <span class="ourapp-landing__recentbody">
                          <span class="ourapp-landing__recenttext">{session.title}</span>
                          <span class="ourapp-landing__recentmeta">
                            {session.relativeAt}
                            {session.subtitle && (
                              <>
                                {" · "}
                                {session.subtitle}
                              </>
                            )}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </aside>
        </Show>
      </main>

      <footer class="ourapp-landing__foot">
        <span>1 кредит ≈ обработка ~2 000 токенов на Lite-модели · цена зависит от выбранной модели</span>
      </footer>
    </div>
  )
}
