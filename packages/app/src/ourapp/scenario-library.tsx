/**
 * OurApp — библиотека сценариев (welcome-state пустой сессии).
 *
 * Соответствует mockup 02 в design/preview.html:
 *   <Hero>          ← серифный «С чего начать?»
 *   <FilterPills>   ← Юрист / Бухгалтер
 *   <Grid>          ← editorial-сетка сценариев (feature-карточка крупная)
 *
 * Controlled-компонент: vertical и onVerticalChange приходят сверху
 * (от NewSessionDesignView), чтобы синхронизироваться с WelcomeSidebar.
 */
import { For, type Component } from "solid-js"
import { SCENARIOS, scenariosFor, type Scenario, type Vertical } from "./scenarios"

export interface ScenarioLibraryProps {
  /** Текущая вертикаль (controlled). */
  vertical: Vertical
  /** Колбэк смены вертикали — родитель отвечает за persist. */
  onVerticalChange: (v: Vertical) => void
  /** Колбэк при клике на карточку. Получает Scenario — нужно поставить prompt в composer. */
  onPick: (scenario: Scenario) => void
}

export const ScenarioLibrary: Component<ScenarioLibraryProps> = (props) => {
  const list = () => scenariosFor(props.vertical)

  return (
    <div class="ourapp-library">
      <header class="ourapp-library__head">
        <div>
          <h1 class="ourapp-library__title">
            С чего <em>начать?</em>
          </h1>
          <p class="ourapp-library__lede">
            Сценарии собраны под вашу профессию. Каждый&nbsp;— пошаговый мастер, а не пустой чат.
          </p>
        </div>
        <div class="ourapp-library__filters" role="tablist" aria-label="Профессия">
          <button
            type="button"
            class="ourapp-pill"
            classList={{ "ourapp-pill--active": props.vertical === "lawyer" }}
            role="tab"
            aria-selected={props.vertical === "lawyer"}
            onClick={() => props.onVerticalChange("lawyer")}
          >
            Юрист
          </button>
          <button
            type="button"
            class="ourapp-pill"
            classList={{ "ourapp-pill--active": props.vertical === "accountant" }}
            role="tab"
            aria-selected={props.vertical === "accountant"}
            onClick={() => props.onVerticalChange("accountant")}
          >
            Бухгалтер
          </button>
        </div>
      </header>

      <div class="ourapp-library__grid">
        <For each={list()}>
          {(s, i) => (
            <article
              class="ourapp-scenario"
              classList={{ "ourapp-scenario--feature": s.feature }}
              tabindex={0}
              role="button"
              aria-label={s.title}
              onClick={() => props.onPick(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  props.onPick(s)
                }
              }}
            >
              <span class="ourapp-scenario__num">
                {String(i() + 1).padStart(2, "0")}
                {s.feature ? " · популярный" : ""}
              </span>
              <h2 class="ourapp-scenario__title">{s.title}</h2>
              <p class="ourapp-scenario__lede">{s.lede}</p>
              <div class="ourapp-scenario__foot">
                <span class="ourapp-scenario__steps">
                  {s.steps} {s.steps === 1 ? "шаг" : s.steps < 5 ? "шага" : "шагов"}
                </span>
                <span class="ourapp-scenario__model">
                  {s.recommendedModel === "lite" && "Lite"}
                  {s.recommendedModel === "mid" && "Sonnet/Pro"}
                  {s.recommendedModel === "top" && "Opus/Max"}
                  {s.recommendedModel === "auto" && "Auto"}
                </span>
              </div>
            </article>
          )}
        </For>
      </div>
    </div>
  )
}

/** Каталог всех сценариев (для тестов, аналитики). */
export { SCENARIOS, scenariosFor }
export type { Scenario, Vertical }
