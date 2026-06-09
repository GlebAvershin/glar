/**
 * OurApp — строка «Авто» в начале списка выбора модели.
 *
 * Выбор этой строки включает режим авто-выбора (store), не меняя «ручную»
 * модель под капотом (она остаётся как fallback). Выбор любой реальной модели
 * в списке — выключает авто (см. onSelect в dialog-select-model*).
 */
import { Component } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { autoModelEnabled, setAutoModelEnabled } from "./store"

export const AutoModelRow: Component<{ onSelect: () => void }> = (props) => {
  const active = () => autoModelEnabled()
  return (
    <button
      type="button"
      role="option"
      aria-selected={active()}
      onClick={() => {
        setAutoModelEnabled(true)
        props.onSelect()
      }}
      class={
        "w-full flex items-center gap-x-2 rounded-md px-2 py-1.5 text-left text-13-regular " +
        "transition-colors duration-100 hover:bg-surface-raised-stronger-non-alpha " +
        (active() ? "text-[#0B5345] [&_svg]:text-[#0B5345]" : "text-text-base")
      }
    >
      <Icon name="brain" size="small" class="shrink-0" />
      <span class="font-[440]">Авто</span>
      <span class="truncate text-text-weak text-12-regular">— выбор модели под задачу</span>
    </button>
  )
}
