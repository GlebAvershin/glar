import { createSignal, type JSX } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { ScenarioLibrary, type Scenario, type Vertical } from "@/ourapp/scenario-library"
import { openScenarioWizard } from "@/ourapp/scenarios/wizard-controller"

const STORAGE_KEY_VERTICAL = "ourapp.primaryVertical"

function loadVertical(): Vertical {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_VERTICAL)
    if (stored === "lawyer" || stored === "accountant") return stored
  } catch {}
  return "lawyer"
}

/**
 * OurApp empty-state новой сессии.
 *
 * Соответствует mockup 01+02 в design/preview.html:
 *   ┌────────┬──────────────────────────────────┐
 *   │        │ ScenarioLibrary (С чего начать?) │
 *   │ Side-  │   editorial grid карточек        │
 *   │ bar    │                                  │
 *   │        ├──────────────────────────────────┤
 *   │        │ Composer (children)              │
 *   └────────┴──────────────────────────────────┘
 *
 * Клик карточки → CustomEvent("ourapp:scenario-pick") → PromptInput
 * подхватывает и заполняет composer.
 */
export function NewSessionDesignView(props: { worktree: string; children: JSX.Element }) {
  const [vertical, setVertical] = createSignal<Vertical>(loadVertical())
  const navigate = useNavigate()

  const onVerticalChange = (v: Vertical) => {
    setVertical(v)
    try {
      localStorage.setItem(STORAGE_KEY_VERTICAL, v)
    } catch {}
  }

  const handlePick = (scenario: Scenario) => {
    // OurApp: открываем мастер сценария. Фоллбек — старое пред-заполнение prompt.
    if (openScenarioWizard(scenario.id)) return
    window.dispatchEvent(
      new CustomEvent("ourapp:scenario-pick", {
        detail: {
          scenarioId: scenario.id,
          prompt: scenario.prompt,
          recommendedModel: scenario.recommendedModel,
        },
      }),
    )
  }

  // WelcomeSidebar теперь рендерится на уровне session.tsx shell — он общий
  // для активной и новой сессии. Здесь только контент панели справа от него.
  // Используем navigate чтобы не было unused-import warning.
  void navigate

  return (
    <div
      data-component="session-new-design"
      class="relative flex h-full w-full flex-col overflow-hidden bg-background-base"
    >
      <div class="flex-1 overflow-y-auto">
        <div class="pt-8 pb-6">
          <ScenarioLibrary
            vertical={vertical()}
            onVerticalChange={onVerticalChange}
            onPick={handlePick}
          />
        </div>
      </div>
      <div class="border-t border-border-weak-base bg-surface-base">
        <div class="mx-auto w-full max-w-[960px] px-8 py-3">
          {props.children}
        </div>
      </div>
    </div>
  )
}
