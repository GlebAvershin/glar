/**
 * OurApp — тумблер «Углублённое размышление» (extended thinking) в композере.
 *
 * Вкл → у Claude-моделей включается extended thinking (variant "high" →
 * нативный thinking-бюджет Anthropic). Для РФ-моделей (GigaChat/YandexGPT)
 * thinking не поддерживается — режим на них не влияет.
 *
 * Состояние — в localStorage (deep-thinking/store.ts).
 */
import { Component, type JSX } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { deepThinkingEnabled, setDeepThinkingEnabled } from "./store"

const TOOLTIP_ON =
  "Углублённое размышление включено. Claude обдумывает ответ дольше (extended thinking) — " +
  "точнее на сложных юридических задачах, но расход кредитов выше. Работает только с Claude " +
  "(GigaChat/YandexGPT режим не поддерживают). Нажмите, чтобы выключить."

const TOOLTIP_OFF =
  "Углублённое размышление. Включит у Claude расширенное обдумывание перед ответом — " +
  "выше точность на сложных задачах ценой большего расхода кредитов."

export const DeepThinkingToggle: Component<{ style?: JSX.CSSProperties }> = (props) => {
  const enabled = () => deepThinkingEnabled()

  return (
    <Tooltip placement="top" value={enabled() ? TOOLTIP_ON : TOOLTIP_OFF} contentClass="max-w-72">
      <Button
        as="div"
        variant="ghost"
        size="normal"
        role="switch"
        aria-checked={enabled()}
        aria-label="Углублённое размышление"
        style={props.style}
        onClick={() => setDeepThinkingEnabled(!enabled())}
        class={
          "shrink-0 gap-x-1 text-[13px] font-[440] leading-4 transition-colors duration-150 " +
          (enabled()
            ? "text-[#0B5345] [&_svg]:text-[#0B5345]"
            : "text-v2-text-text-faint [&_svg]:opacity-40 hover:[&_svg]:opacity-100")
        }
      >
        <Icon name="glasses" size="small" class="shrink-0" />
        <span>Углублённо</span>
      </Button>
    </Tooltip>
  )
}
