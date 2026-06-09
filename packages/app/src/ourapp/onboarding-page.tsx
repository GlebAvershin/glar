/**
 * OurApp двухдверный онбординг с magic-link входом.
 *
 * Шаги:
 *   1. Welcome — выбор вертикали (юрист/бухгалтер)
 *   2. Email — ввод email + POST /auth/magic-link
 *   3. Verify — «Проверь почту» + (dev) форма прямого ввода token
 *
 * После успешной verify — сохраняем JWT в localStorage и закрываем онбординг
 * через callback.
 */
import { createSignal, Show, type Component } from "solid-js"
import { billingApi } from "./billing-api"
import { setSessionToken } from "./auth-storage"
import type { Vertical } from "./scenario-library"

type Step = "welcome" | "email" | "verify" | "done"

export const OnboardingPage: Component<{ onDone: () => void }> = (props) => {
  const [step, setStep] = createSignal<Step>("welcome")
  const [vertical, setVertical] = createSignal<Vertical>("lawyer")
  const [email, setEmail] = createSignal("")
  // Поле кода: только цифры, до 6. Пробелы и любое нецифровое — игнорим.
  const [codeInput, setCodeInput] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const onCodeInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const raw = e.currentTarget.value
    const cleaned = raw.replace(/\D/g, "").slice(0, 6)
    setCodeInput(cleaned)
    e.currentTarget.value = cleaned
  }

  const pickVertical = (v: Vertical) => {
    setVertical(v)
    try {
      localStorage.setItem("ourapp.primaryVertical", v)
    } catch {}
    setStep("email")
  }

  const sendMagic = async (e: Event) => {
    e.preventDefault()
    setError(null)
    const value = email().trim()
    if (!value.includes("@")) {
      setError("Введите корректный email")
      return
    }
    setBusy(true)
    const res = await billingApi.requestMagicLink(value)
    setBusy(false)
    if (!res.ok) {
      setError(`Не удалось отправить ссылку: ${res.error}`)
      return
    }
    setStep("verify")
  }

  const verifyCode = async (e: Event) => {
    e.preventDefault()
    setError(null)
    const code = codeInput()
    if (code.length !== 6) {
      setError("Код должен состоять из 6 цифр")
      return
    }
    setBusy(true)
    const res = await billingApi.verifyOtp(email().trim(), code)
    setBusy(false)
    if (!res.ok) {
      setError(
        res.error === "invalid_or_expired_code"
          ? "Неверный или истёкший код. Запросите новый."
          : `Не удалось войти: ${res.error}`,
      )
      return
    }
    setSessionToken(res.data.token)
    setStep("done")
    props.onDone()
  }

  return (
    <div class="ourapp-onboarding">
      <header class="ourapp-onboarding__topbar">
        <span class="ourapp-onboarding__brand">Параграф</span>
        <Show when={step() !== "welcome"}>
          <button
            type="button"
            class="ourapp-onboarding__back"
            onClick={() => setStep(step() === "verify" ? "email" : "welcome")}
          >
            ← Назад
          </button>
        </Show>
      </header>

      <main class="ourapp-onboarding__main">
        {/* ===== Step 1: Welcome ===== */}
        <Show when={step() === "welcome"}>
          <div class="ourapp-onboarding__step">
            <div class="ourapp-onboarding__eyebrow">Добро пожаловать</div>
            <h1 class="ourapp-onboarding__title">
              ИИ-агент <em>для&nbsp;вашей&nbsp;работы</em>
            </h1>
            <p class="ourapp-onboarding__lede">
              Прочитает договор, найдёт риски, ответит на&nbsp;требование ФНС, объяснит норму
              НК. Сценарии собраны под профессию&nbsp;— чтобы не&nbsp;было пустого чата.
            </p>
            <div class="ourapp-onboarding__doors">
              <button
                type="button"
                class="ourapp-onboarding__door"
                onClick={() => pickVertical("lawyer")}
              >
                <span class="ourapp-onboarding__doorTitle">Я&nbsp;юрист</span>
                <span class="ourapp-onboarding__doorLede">
                  Договоры, претензии, иски, ДДУ, корп. право
                </span>
              </button>
              <button
                type="button"
                class="ourapp-onboarding__door"
                onClick={() => pickVertical("accountant")}
              >
                <span class="ourapp-onboarding__doorTitle">Я&nbsp;бухгалтер</span>
                <span class="ourapp-onboarding__doorLede">
                  Первичка, отчётность, ФНС, НК, контрагенты
                </span>
              </button>
            </div>
            <div class="ourapp-onboarding__foot">
              Можно сменить позже в&nbsp;настройках.
            </div>
          </div>
        </Show>

        {/* ===== Step 2: Email ===== */}
        <Show when={step() === "email"}>
          <form class="ourapp-onboarding__step" onSubmit={sendMagic}>
            <div class="ourapp-onboarding__eyebrow">
              Шаг 2 из 3 · {vertical() === "lawyer" ? "Юрист" : "Бухгалтер"}
            </div>
            <h1 class="ourapp-onboarding__title">
              Ваш <em>email</em>
            </h1>
            <p class="ourapp-onboarding__lede">
              Отправим 6-значный код для&nbsp;входа. Пароли не&nbsp;нужны&nbsp;— ввели код
              и&nbsp;вы&nbsp;внутри.
            </p>
            <div class="ourapp-onboarding__field">
              <label class="ourapp-onboarding__label" for="onb-email">
                Email
              </label>
              <input
                id="onb-email"
                type="email"
                class="ourapp-onboarding__input"
                placeholder="anna.petrova@yur-firma.ru"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                ref={(el) => setTimeout(() => el?.focus(), 50)}
                disabled={busy()}
              />
            </div>
            <Show when={error()}>
              <div class="ourapp-onboarding__error">{error()}</div>
            </Show>
            <div class="ourapp-onboarding__actions">
              <button
                type="submit"
                class="ourapp-btn ourapp-btn--primary"
                disabled={busy() || !email().includes("@")}
              >
                {busy() ? "Отправляем…" : "Получить код →"}
              </button>
            </div>
            <div class="ourapp-onboarding__foot">
              Нажимая, вы соглашаетесь с&nbsp;офертой и&nbsp;обработкой персональных данных (152-ФЗ).
            </div>
          </form>
        </Show>

        {/* ===== Step 3: Verify OTP ===== */}
        <Show when={step() === "verify"}>
          <form class="ourapp-onboarding__step" onSubmit={verifyCode}>
            <div class="ourapp-onboarding__eyebrow">Шаг 3 из 3</div>
            <h1 class="ourapp-onboarding__title">
              Проверьте <em>почту</em>
            </h1>
            <p class="ourapp-onboarding__lede">
              Отправили 6-значный код на&nbsp;<strong>{email()}</strong>. Введите его ниже.
              Письмо не&nbsp;пришло через&nbsp;2&nbsp;минуты — проверьте папку «Спам».
            </p>

            <div class="ourapp-onboarding__field">
              <input
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                class="ourapp-onboarding__input ourapp-onboarding__input--mono"
                placeholder="000 000"
                value={codeInput()}
                onInput={onCodeInput}
                disabled={busy()}
                style={{
                  "letter-spacing": "0.4em",
                  "text-align": "center",
                  "font-size": "24px",
                  "max-width": "240px",
                  margin: "0 auto",
                }}
                autofocus
                maxLength={6}
              />
            </div>
            <Show when={error()}>
              <div class="ourapp-onboarding__error">{error()}</div>
            </Show>
            <div class="ourapp-onboarding__actions">
              <button
                type="submit"
                class="ourapp-btn ourapp-btn--primary"
                disabled={busy() || codeInput().length !== 6}
              >
                {busy() ? "Проверяем…" : "Войти →"}
              </button>
            </div>

            <div class="ourapp-onboarding__foot">
              Не пришло письмо?{" "}
              <button type="button" class="ourapp-onboarding__link" onClick={() => setStep("email")}>
                Сменить email или запросить заново
              </button>
            </div>
          </form>
        </Show>
      </main>
    </div>
  )
}
