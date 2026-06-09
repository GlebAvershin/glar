/**
 * OurApp — дашборд аналитики использования (ТЗ-05 §6).
 *
 * Сводка + график по дням + разбивка по моделям/сценариям + CSV экспорт.
 * Данные через usage-api → /usage/summary.
 */
import { For, Show, createResource, createSignal, type Component } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { Icon } from "@opencode-ai/ui/icon"
import { periodRange, usageApi, type UsagePeriod } from "@/ourapp/usage-api"
import { BarChart } from "@/ourapp/charts/bar-chart"
import { SCENARIOS as WIZARD_SCENARIOS } from "@/ourapp/scenarios/index"
import "./analytics.css"

const PERIOD_LABELS: Record<UsagePeriod, string> = {
  week: "Неделя",
  month: "Месяц",
  year: "Год",
}

export const AnalyticsPage: Component = () => {
  const navigate = useNavigate()
  const [period, setPeriod] = createSignal<UsagePeriod>("month")

  const [summary, { refetch }] = createResource(period, async (p) => {
    const { from, to } = periodRange(p)
    const r = await usageApi.summary(from, to)
    return r.ok ? r.data : null
  })

  const exportCsv = async () => {
    const { from, to } = periodRange(period())
    const ok = await usageApi.exportCsv(from, to)
    if (!ok) {
      alert("Не удалось выгрузить CSV. Попробуйте позже.")
    }
  }

  const formatDay = (iso: string) => {
    const d = new Date(iso + "T00:00:00")
    return d.toLocaleDateString("ru", { day: "numeric", month: "short" })
  }

  const scenarioTitle = (id: string) =>
    WIZARD_SCENARIOS.find((s) => s.id === id)?.title ?? id

  return (
    <div class="ourapp-analytics">
      <header class="ourapp-analytics__topbar">
        <button type="button" class="ourapp-settings__back" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div class="ourapp-settings__crumb">Профиль · Аналитика</div>
      </header>

      <main class="ourapp-analytics__main">
        <h1 class="ourapp-analytics__title">
          <em>Расход</em> и аналитика
        </h1>
        <p class="ourapp-analytics__lede">
          Сколько кредитов потрачено по дням, моделям и сценариям. Можно
          выгрузить CSV для бухгалтерии фирмы.
        </p>

        <div class="ourapp-analytics__filters">
          <div class="ourapp-settings__pills">
            <For each={["week", "month", "year"] as UsagePeriod[]}>
              {(p) => (
                <button
                  type="button"
                  class="ourapp-pill"
                  classList={{ "ourapp-pill--active": period() === p }}
                  onClick={() => setPeriod(p)}
                >
                  {PERIOD_LABELS[p]}
                </button>
              )}
            </For>
          </div>
          <button type="button" class="ourapp-btn" onClick={exportCsv}>
            <Icon name="download" class="size-4" />
            CSV для бухгалтерии
          </button>
        </div>

        <Show
          when={!summary.loading}
          fallback={<div class="ourapp-analytics__loading">Загружаем…</div>}
        >
          <Show
            when={summary()}
            fallback={
              <div class="ourapp-analytics__empty">
                Не удалось получить аналитику. Проверьте подключение к серверу
                или попробуйте позже. Если данных пока нет — сделайте несколько
                запросов в чате, аналитика появится в течение нескольких минут.
              </div>
            }
          >
            {(s) => (
              <>
                <div class="ourapp-analytics__cards">
                  <article class="ourapp-analytics__card">
                    <div class="ourapp-analytics__cardLabel">Всего кредитов</div>
                    <div class="ourapp-analytics__cardValue">{s().totalCredits}</div>
                  </article>
                  <article class="ourapp-analytics__card">
                    <div class="ourapp-analytics__cardLabel">Запросов</div>
                    <div class="ourapp-analytics__cardValue">{s().totalRequests}</div>
                  </article>
                  <article class="ourapp-analytics__card">
                    <div class="ourapp-analytics__cardLabel">Средне за запрос</div>
                    <div class="ourapp-analytics__cardValue">
                      {s().avgCreditsPerRequest}
                    </div>
                  </article>
                </div>

                <section class="ourapp-analytics__section">
                  <h2 class="ourapp-analytics__sectionTitle">Расход по дням</h2>
                  <BarChart
                    data={s().byDay.map((d) => ({ label: d.day, value: d.credits }))}
                    unit="кредитов"
                    formatLabel={formatDay}
                    height={200}
                  />
                </section>

                <section class="ourapp-analytics__section">
                  <h2 class="ourapp-analytics__sectionTitle">По моделям</h2>
                  <Show
                    when={s().byModel.length > 0}
                    fallback={<div class="ourapp-analytics__empty">Нет данных</div>}
                  >
                    <table class="ourapp-analytics__table">
                      <thead>
                        <tr>
                          <th>Модель</th>
                          <th>Запросов</th>
                          <th>Кредитов</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={s().byModel}>
                          {(m) => (
                            <tr>
                              <td>{m.model}</td>
                              <td class="ourapp-analytics__num">{m.requests}</td>
                              <td class="ourapp-analytics__num">{m.credits}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </Show>
                </section>

                <Show when={s().byScenario.length > 0}>
                  <section class="ourapp-analytics__section">
                    <h2 class="ourapp-analytics__sectionTitle">Топ сценариев</h2>
                    <table class="ourapp-analytics__table">
                      <thead>
                        <tr>
                          <th>Сценарий</th>
                          <th>Запусков</th>
                          <th>Кредитов</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={s().byScenario}>
                          {(sc) => (
                            <tr>
                              <td>{scenarioTitle(sc.scenarioId)}</td>
                              <td class="ourapp-analytics__num">{sc.requests}</td>
                              <td class="ourapp-analytics__num">{sc.credits}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </section>
                </Show>

                <button
                  type="button"
                  class="ourapp-btn"
                  onClick={() => refetch()}
                  style={{ "margin-top": "16px" }}
                >
                  Обновить
                </button>
              </>
            )}
          </Show>
        </Show>
      </main>
    </div>
  )
}

export default AnalyticsPage
