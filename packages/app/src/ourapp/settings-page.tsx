/**
 * OurApp — страница «Настройки».
 *
 * Минимум полей:
 *   - Email юзера (из /me)
 *   - Вертикаль: переключатель Юрист/Бухгалтер (localStorage)
 *   - Тема: Light / Dark / System (через useTheme из opencode)
 *   - Выйти из аккаунта (clear sessionToken + перерисовка gate)
 *
 * Layout — как credits-page (mockup-style + cream paper-grain).
 */
import { createResource, createSignal, type Component } from "solid-js"
import { useTheme, type ColorScheme } from "@opencode-ai/ui/theme"
import { billingApi } from "./billing-api"
import { clearSession } from "./auth-storage"
import type { Vertical } from "./scenario-library"
import { AboutModal } from "./about-modal"
import "./about-modal.css"
import "./pii.css"
import { useLanguage } from "@/context/language"
import { PiiSettingsSection } from "./pii-settings"

export const SettingsPage: Component<{ onClose?: () => void }> = (props) => {
  const theme = useTheme()
  const language = useLanguage()
  const [me] = createResource(() => billingApi.me().then((r) => (r.ok ? r.data : null)))
  const [aboutOpen, setAboutOpen] = createSignal(false)

  const initialVertical: Vertical = (() => {
    try {
      const v = localStorage.getItem("ourapp.primaryVertical")
      return v === "accountant" ? "accountant" : "lawyer"
    } catch {
      return "lawyer"
    }
  })()
  const [vertical, setVertical] = createSignal<Vertical>(initialVertical)

  const updateVertical = (v: Vertical) => {
    setVertical(v)
    try {
      localStorage.setItem("ourapp.primaryVertical", v)
    } catch {}
  }

  const updateScheme = (scheme: ColorScheme) => {
    theme.setColorScheme(scheme)
  }

  const handleLogout = () => {
    if (!confirm("Выйти из аккаунта? Все локальные данные сохранятся в браузере.")) return
    clearSession()
    // После clearSession диспатчится "ourapp:session-changed",
    // OnboardingGate перерисуется и покажет онбординг.
  }

  return (
    <div class="ourapp-settings">
      <header class="ourapp-settings__topbar">
        <button type="button" class="ourapp-settings__back" onClick={props.onClose}>
          ← Назад
        </button>
        <div class="ourapp-settings__crumb">Профиль · Настройки</div>
      </header>

      <main class="ourapp-settings__main">
        <h1 class="ourapp-settings__title">
          <em>Настройки</em>
        </h1>

        <section class="ourapp-settings__card">
          <div class="ourapp-settings__label">Аккаунт</div>
          <div class="ourapp-settings__row">
            <span class="ourapp-settings__rowLabel">Email</span>
            <span class="ourapp-settings__rowValue">{me()?.user?.email ?? "—"}</span>
          </div>
          <div class="ourapp-settings__row">
            <span class="ourapp-settings__rowLabel">Тариф</span>
            <span class="ourapp-settings__rowValue">{me()?.plan?.titleRu ?? "—"}</span>
          </div>
          <div class="ourapp-settings__rowActions">
            <button type="button" class="ourapp-btn ourapp-btn--danger" onClick={handleLogout}>
              Выйти из аккаунта
            </button>
          </div>
        </section>

        <section class="ourapp-settings__card">
          <div class="ourapp-settings__label">Профессия</div>
          <p class="ourapp-settings__lede">
            Под выбранную профессию подбираются сценарии и подсказки. Можно поменять в любой момент.
          </p>
          <div class="ourapp-settings__pills">
            <button
              type="button"
              class="ourapp-pill"
              classList={{ "ourapp-pill--active": vertical() === "lawyer" }}
              onClick={() => updateVertical("lawyer")}
            >
              Юрист
            </button>
            <button
              type="button"
              class="ourapp-pill"
              classList={{ "ourapp-pill--active": vertical() === "accountant" }}
              onClick={() => updateVertical("accountant")}
            >
              Бухгалтер
            </button>
          </div>
        </section>

        <section class="ourapp-settings__card">
          <div class="ourapp-settings__label">Внешний вид</div>
          <p class="ourapp-settings__lede">
            Тема приложения. «Системная» подстраивается под настройку ОС.
          </p>
          <div class="ourapp-settings__pills">
            <button
              type="button"
              class="ourapp-pill"
              classList={{ "ourapp-pill--active": theme.colorScheme() === "light" }}
              onClick={() => updateScheme("light")}
            >
              Светлая
            </button>
            <button
              type="button"
              class="ourapp-pill"
              classList={{ "ourapp-pill--active": theme.colorScheme() === "dark" }}
              onClick={() => updateScheme("dark")}
            >
              Тёмная
            </button>
            <button
              type="button"
              class="ourapp-pill"
              classList={{ "ourapp-pill--active": theme.colorScheme() === "system" }}
              onClick={() => updateScheme("system")}
            >
              Системная
            </button>
          </div>
        </section>

        <section class="ourapp-settings__card">
          <div class="ourapp-settings__label">Язык</div>
          <p class="ourapp-settings__lede">
            Язык интерфейса. По умолчанию — русский.
          </p>
          <div class="ourapp-settings__pills">
            <button
              type="button"
              class="ourapp-pill"
              classList={{ "ourapp-pill--active": language.locale() === "ru" }}
              onClick={() => language.setLocale("ru")}
            >
              Русский
            </button>
            <button
              type="button"
              class="ourapp-pill"
              classList={{ "ourapp-pill--active": language.locale() === "en" }}
              onClick={() => language.setLocale("en")}
            >
              English
            </button>
          </div>
        </section>

        <PiiSettingsSection />

        <section class="ourapp-settings__card">
          <div class="ourapp-settings__label">О приложении</div>
          <div class="ourapp-settings__row">
            <span class="ourapp-settings__rowLabel">Версия</span>
            <span class="ourapp-settings__rowValue">0.1.0 · ourapp/main</span>
          </div>
          <div class="ourapp-settings__row">
            <span class="ourapp-settings__rowLabel">Gateway</span>
            <span class="ourapp-settings__rowValue">{me()?.gateway?.baseUrl ?? "—"}</span>
          </div>
          <div class="ourapp-settings__rowActions">
            <button type="button" class="ourapp-btn" onClick={() => setAboutOpen(true)}>
              О Параграфе
            </button>
          </div>
        </section>
      </main>

      <AboutModal open={aboutOpen()} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
