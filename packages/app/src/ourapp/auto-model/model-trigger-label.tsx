/**
 * OurApp — содержимое кнопки-триггера выбора модели в композере.
 *
 * Если включён режим «Авто» — показываем «Авто» с иконкой; иначе обычно:
 * иконка провайдера + имя текущей модели. Заменяет повторяющийся inline-блок
 * в 4 местах prompt-input (платный/бесплатный × старый/новый дизайн).
 */
import { Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { useLocal } from "@/context/local"
import { useLanguage } from "@/context/language"
import { autoModelEnabled } from "./store"

export function ModelTriggerLabel() {
  const local = useLocal()
  const language = useLanguage()
  return (
    <Show
      when={autoModelEnabled()}
      fallback={
        <>
          <Show when={local.model.current()?.provider?.id}>
            <ProviderIcon
              id={local.model.current()?.provider?.id ?? ""}
              class="size-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity duration-150"
              style={{ "will-change": "opacity", transform: "translateZ(0)" }}
            />
          </Show>
          <span class="truncate">{local.model.current()?.name ?? language.t("dialog.model.select.title")}</span>
        </>
      }
    >
      <Icon name="brain" size="small" class="size-4 shrink-0 text-[#0B5345]" />
      <span class="truncate text-[#0B5345]">Авто</span>
    </Show>
  )
}
