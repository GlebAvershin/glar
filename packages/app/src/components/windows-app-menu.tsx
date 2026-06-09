import { Show } from "solid-js"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { IconButtonV2 } from "@opencode-ai/ui/v2/components/icon-button-v2.jsx"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/components/icon.jsx"

import { useCommand } from "@/context/command"
import { type DesktopMenuAction, type DesktopMenuEntry } from "@/desktop-menu"
import { usePlatform } from "@/context/platform"

// OurApp: плоское упрощённое меню «Параграф» (вместо вложенных File/Edit/View/…
// от opencode). Только то, что реально нужно нашей аудитории. «Настройки» ведёт
// на нашу страницу /settings (см. settings.open в layout.tsx). Стандартные действия
// (копировать/вставить, свернуть/закрыть) убраны — они есть в горячих клавишах и
// кнопках окна.
const HAMBURGER_ITEMS: DesktopMenuEntry[] = [
  { type: "item", label: "Новая задача", command: "session.new" },
  { type: "item", label: "Настройки", command: "settings.open", accelerator: { windows: "Ctrl+," } },
  { type: "separator" },
  { type: "item", label: "Увеличить", action: "view.zoomIn", accelerator: { windows: "Ctrl++" } },
  { type: "item", label: "Уменьшить", action: "view.zoomOut", accelerator: { windows: "Ctrl+-" } },
  { type: "item", label: "Масштаб 100%", action: "view.resetZoom", accelerator: { windows: "Ctrl+0" } },
  { type: "separator" },
  { type: "item", label: "Полноэкранный режим", action: "view.toggleFullscreen" },
  { type: "item", label: "Перезагрузить", action: "view.reload" },
  { type: "separator" },
  { type: "item", label: "Экспорт логов…", command: "logs.export" },
  { type: "item", label: "Написать в поддержку", href: "mailto:support@paragraf.app" },
]

export function WindowsAppMenu(props: {
  command: ReturnType<typeof useCommand>
  platform: ReturnType<typeof usePlatform>
  variant?: "legacy" | "v2"
}) {
  let lastFocused: HTMLElement | undefined

  const rememberFocus = () => {
    const active = document.activeElement
    lastFocused = active instanceof HTMLElement ? active : undefined
  }
  const commandDisabled = (id: string) => {
    const option = props.command.options.find((option) => option.id === id)
    if (!option) return true
    return option.disabled ?? false
  }
  const runCommand = (id: string) => {
    if (commandDisabled(id)) return
    props.command.trigger(id)
  }
  const runAction = (action: DesktopMenuAction) => {
    if (action.startsWith("edit.") && lastFocused?.isConnected) lastFocused.focus({ preventScroll: true })
    void props.platform.runDesktopMenuAction?.(action)
  }
  const runEntry = (entry: DesktopMenuEntry) => {
    if (entry.type === "separator") return
    if (entry.command) {
      runCommand(entry.command)
      return
    }
    if (entry.action) {
      runAction(entry.action)
      return
    }
    if (entry.href) props.platform.openLink(entry.href)
  }

  return (
    <DropdownMenu gutter={4} modal={false} placement="bottom-start">
      {props.variant === "v2" ? (
        <div
          data-component="desktop-icon-button"
          class="flex h-7 w-9 shrink-0 items-center justify-center rounded-[6px] px-1"
        >
          <DropdownMenu.Trigger
            as={IconButtonV2}
            variant="ghost-muted"
            size="large"
            icon={<IconV2 name="menu" />}
            aria-label="Меню Параграф"
            onPointerDown={rememberFocus}
            onKeyDown={rememberFocus}
          />
        </div>
      ) : (
        <DropdownMenu.Trigger
          as={IconButton}
          icon="menu"
          variant="ghost"
          class="titlebar-icon rounded-md shrink-0"
          aria-label="Меню Параграф"
          onPointerDown={rememberFocus}
          onKeyDown={rememberFocus}
        />
      )}
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="desktop-app-menu">
          <DropdownMenu.Group>
            <DropdownMenu.GroupLabel class="desktop-app-menu-heading">Параграф</DropdownMenu.GroupLabel>
            {HAMBURGER_ITEMS.map((entry) =>
              entry.type === "separator" ? (
                <DropdownMenu.Separator />
              ) : (
                <DesktopMenuItem
                  label={entry.label ?? ""}
                  keybind={entry.command ? props.command.keybind(entry.command) : entry.accelerator?.windows}
                  disabled={entry.command ? commandDisabled(entry.command) : false}
                  onSelect={() => runEntry(entry)}
                />
              ),
            )}
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

function DesktopMenuItem(props: { label: string; keybind?: string; disabled?: boolean; onSelect: () => void }) {
  return (
    <DropdownMenu.Item disabled={props.disabled} onSelect={props.onSelect}>
      <DropdownMenu.ItemLabel>{props.label}</DropdownMenu.ItemLabel>
      <Show when={props.keybind}>
        <span data-slot="desktop-app-menu-keybind">{props.keybind}</span>
      </Show>
    </DropdownMenu.Item>
  )
}
