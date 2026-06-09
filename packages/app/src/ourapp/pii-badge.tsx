/**
 * OurApp — бейдж «Защита ПДн» в composer (ТЗ-04 §7.2).
 *
 * Показывается рядом с кнопкой Send. Кликабельный — навигирует в настройки.
 */
import { Show, type Component } from "solid-js"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Icon } from "@opencode-ai/ui/icon"
import { effectivePiiMode, piiMode } from "./pii/settings-store"

export interface PiiBadgeProps {
  /** Код выбранной модели — для проверки auto-off для РФ-моделей. */
  modelCode?: string
  /** Провайдер модели (anthropic/openai/gigachat/yandex). */
  provider?: string
  onClick?: () => void
}

export const PiiBadge: Component<PiiBadgeProps> = (props) => {
  const mode = () => piiMode()
  const effective = () => effectivePiiMode(props.modelCode, props.provider)
  const ruAuto = () => mode() !== "off" && effective() === "off"

  const tooltip = () => {
    if (mode() === "off") return "Защита ПДн выключена. Включить — Настройки → Защита ПДн"
    if (ruAuto()) return "Выбрана российская модель — маскирование не требуется (данные не покидают РФ)"
    if (mode() === "soft") return "Маскируются: паспорт, карта, СНИЛС. Изменить — Настройки"
    return "Маскируются ФИО, паспорта, ИНН и другие ПДн перед отправкой"
  }

  return (
    <Show when={true}>
      <Tooltip value={tooltip()} placement="top" contentClass="max-w-64">
        <button
          type="button"
          class="ourapp-pii-badge"
          classList={{
            "ourapp-pii-badge--off": mode() === "off",
            "ourapp-pii-badge--ru": ruAuto(),
            "ourapp-pii-badge--soft": mode() === "soft" && !ruAuto(),
          }}
          aria-label={tooltip()}
          onClick={props.onClick}
        >
          <Icon name="shield" class="size-3.5" />
          <span class="ourapp-pii-badge__text">
            <Show
              when={mode() === "off"}
              fallback={
                <Show when={ruAuto()} fallback={<>ПДн</>}>
                  ПДн · РФ
                </Show>
              }
            >
              ПДн off
            </Show>
          </span>
        </button>
      </Tooltip>
    </Show>
  )
}
