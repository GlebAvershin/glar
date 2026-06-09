/**
 * OurApp — guard от низкого/нулевого остатка кредитов.
 *
 * Двухуровневая защита перед отправкой запроса:
 *   - SOFT (предупреждение): остаток < 20% месячного лимита → toast один раз
 *     за сессию работы приложения. Не блокирует отправку.
 *   - HARD (блокировка): остаток === 0 → модалка с двумя CTA:
 *     «Докупить кредиты» / «Сменить тариф». Отправка отменяется.
 *
 * Использование:
 *   1. Один раз смонтировать <LowBalanceModal /> где-то наверху дерева.
 *   2. Перед отправкой:  if (!(await guardSendCredits())) return
 */
import { createSignal, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { billingApi } from "./billing-api"

const WARN_THRESHOLD_RATIO = 0.2 // 20% от месячной нормы

// Глобальное состояние модалки (синглтон на renderer).
const [modalOpen, setModalOpen] = createSignal(false)

// Soft-баннер: остаток+норма. null = баннер не показан.
interface SoftWarning {
  remaining: number
  monthlyTotal: number
}
const [softWarning, setSoftWarning] = createSignal<SoftWarning | null>(null)

// Флаг — показали ли уже soft-предупреждение в этой сессии работы приложения.
// Не сохраняем в localStorage: при перезапуске юзер увидит предупреждение
// снова — это нормально, оно про текущий контекст работы.
let softWarnedThisSession = false

/**
 * Проверить остаток кредитов перед отправкой запроса.
 * @returns true если можно отправлять, false если заблокировано (модалка показана).
 */
export async function guardSendCredits(): Promise<boolean> {
  const res = await billingApi.limits()
  if (!res.ok) {
    // Если billing недоступен — пропускаем отправку (Gateway сам перехватит при
    // реальном овердрафте через LiteLLM hardcap). Лучше дать юзеру попробовать,
    // чем заблокировать из-за дев-неудачи billing-сервиса.
    return true
  }

  const { remaining, monthlyTotal } = res.data.credits

  // HARD: 0 кредитов → блокируем + модалка
  if (remaining <= 0) {
    setModalOpen(true)
    return false
  }

  // SOFT: < 20% → одноразовый кастомный баннер за сессию
  const warnThreshold = Math.max(1, Math.floor(monthlyTotal * WARN_THRESHOLD_RATIO))
  if (remaining <= warnThreshold && !softWarnedThisSession) {
    softWarnedThisSession = true
    setSoftWarning({ remaining, monthlyTotal })
  }

  return true
}

/**
 * Сбросить флаг «уже предупреждали» — например, после успешной докупки/смены тарифа,
 * чтобы при следующем приближении к лимиту юзер снова увидел предупреждение.
 */
export function resetLowBalanceWarning() {
  softWarnedThisSession = false
  setSoftWarning(null)
}

/**
 * Soft-баннер в правом нижнем углу. Стиль — DESIGN.md (кремовый, серифный
 * заголовок, emerald-акцент). Автоматически уходит через 8 сек или по крестику.
 */
export function LowBalanceBanner() {
  const navigate = useNavigate()
  const handleClose = () => setSoftWarning(null)
  const handleTopup = () => {
    setSoftWarning(null)
    navigate("/credits?focus=topup")
  }

  // Авто-скрытие через 8 сек
  let timer: ReturnType<typeof setTimeout> | undefined
  const onMount = (el: HTMLDivElement) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => setSoftWarning(null), 8000)
    void el
  }

  return (
    <Show when={softWarning()}>
      {(warn) => (
        <div
          ref={onMount}
          data-component="low-balance-banner"
          class="fixed bottom-6 right-6 z-[90] max-w-sm animate-in slide-in-from-bottom-2 duration-200"
        >
          <div
            class="rounded-lg shadow-lg border px-4 py-3 flex items-start gap-3"
            style={{
              "background-color": "#FBF9F4",
              "border-color": "#D8D2C5",
            }}
          >
            <div
              class="mt-0.5 size-2 rounded-full shrink-0"
              style={{ "background-color": "#0B5345" }}
              aria-hidden="true"
            />
            <div class="flex-1 min-w-0">
              <div
                class="text-[14px] mb-0.5"
                style={{
                  "font-family": "'IBM Plex Serif', Georgia, serif",
                  color: "#2A2723",
                  "font-weight": "500",
                }}
              >
                Кредиты на исходе
              </div>
              <div class="text-[13px] leading-relaxed" style={{ color: "#5C5852" }}>
                Осталось <strong style={{ color: "#2A2723" }}>{warn().remaining}</strong> из {warn().monthlyTotal}.
                Можно докупить или сменить тариф.
              </div>
              <button
                type="button"
                onClick={handleTopup}
                class="mt-2 text-[12px] underline decoration-dotted underline-offset-2"
                style={{ color: "#0B5345" }}
              >
                Подробнее
              </button>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Закрыть"
              class="shrink-0 size-5 flex items-center justify-center rounded hover:bg-[#F0EBE0] transition-colors"
              style={{ color: "#5C5852" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </Show>
  )
}

/**
 * Глобальная модалка «кредиты закончились». Показывается guard'ом.
 * Должна быть смонтирована один раз на уровне приложения.
 */
export function LowBalanceModal() {
  const navigate = useNavigate()
  const handleClose = () => setModalOpen(false)
  // «Докупить» → страница /credits, где ?focus=topup сразу запускает виджет
  // привязки карты + докупку (см. credits-page onMount).
  const handleTopup = () => {
    setModalOpen(false)
    navigate("/credits?focus=topup")
  }
  // «Сменить тариф» → страница /credits, где ?focus=plans сразу открывает
  // модалку сравнения тарифов (plan-change-modal). Держим единственную
  // реализацию модалки на странице биллинга, а не дублируем её в guard.
  const handleChangePlan = () => {
    setModalOpen(false)
    navigate("/credits?focus=plans")
  }

  return (
    <Show when={modalOpen()}>
      <div
        data-component="low-balance-modal"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-in fade-in duration-150"
        onClick={handleClose}
      >
        <div
          class="bg-[var(--color-bg-base,#FBF9F4)] border border-[var(--color-hairline-strong,#D8D2C5)] rounded-lg shadow-xl max-w-md w-full mx-4 p-6 animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="text-[20px] font-medium mb-2" style={{ "font-family": "'IBM Plex Serif', serif" }}>
            Кредиты закончились
          </h2>
          <p class="text-[14px] text-[var(--color-text-secondary,#5C5852)] mb-5 leading-relaxed">
            В этом месяце вы использовали всю норму подписки. Чтобы продолжить — докупите
            дополнительные кредиты (не сгорают в этом месяце) или перейдите на больший тариф.
          </p>
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              class="px-3.5 py-1.5 rounded-md text-[13px] transition-colors"
              style={{ color: "#5C5852" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0EBE0")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleChangePlan}
              class="px-3.5 py-1.5 rounded-md text-[13px] border transition-colors"
              style={{ "border-color": "#D8D2C5", color: "#2A2723", "background-color": "#FBF9F4" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F6F2EB")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FBF9F4")}
            >
              Сменить тариф
            </button>
            <button
              type="button"
              onClick={handleTopup}
              class="px-3.5 py-1.5 rounded-md text-[13px] border font-medium transition-colors"
              style={{ "border-color": "#0B5345", color: "#0B5345", "background-color": "#FBF9F4" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#0B5345"
                e.currentTarget.style.color = "#FBF9F4"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#FBF9F4"
                e.currentTarget.style.color = "#0B5345"
              }}
            >
              Докупить кредиты
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
