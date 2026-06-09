/**
 * OurApp OnboardingGate — корневой gate для проверки авторизации.
 *
 * Если у пользователя нет сохранённого JWT (auth-storage) → рендерим
 * OnboardingPage. Иначе пропускаем children (нормальный роутер с Home/Session).
 *
 * Подписка на window-event `ourapp:session-changed` — после verify токена
 * onboarding-страница диспатчит, gate авто-перерисовывается.
 */
import { createSignal, onCleanup, onMount, Show, type JSX, type Component } from "solid-js"
import { isLoggedIn } from "./auth-storage"
import { OnboardingPage } from "./onboarding-page"

export const OnboardingGate: Component<{ children: JSX.Element }> = (props) => {
  const [loggedIn, setLoggedIn] = createSignal(isLoggedIn())

  onMount(() => {
    const onChanged = () => setLoggedIn(isLoggedIn())
    window.addEventListener("ourapp:session-changed", onChanged)
    onCleanup(() => window.removeEventListener("ourapp:session-changed", onChanged))
  })

  return (
    <Show when={loggedIn()} fallback={<OnboardingPage onDone={() => setLoggedIn(true)} />}>
      {props.children}
    </Show>
  )
}
