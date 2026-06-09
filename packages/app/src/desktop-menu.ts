export type DesktopMenuPlatform = "macos" | "windows"

export type DesktopMenuAction =
  | "app.checkForUpdates"
  | "app.relaunch"
  | "edit.undo"
  | "edit.redo"
  | "edit.cut"
  | "edit.copy"
  | "edit.paste"
  | "edit.delete"
  | "edit.selectAll"
  | "view.reload"
  | "view.toggleDevTools"
  | "view.resetZoom"
  | "view.zoomIn"
  | "view.zoomOut"
  | "view.toggleFullscreen"
  | "window.new"
  | "window.close"
  | "window.minimize"
  | "window.toggleMaximize"

export type DesktopMenuRole =
  | "about"
  | "close"
  | "copy"
  | "cut"
  | "hide"
  | "hideOthers"
  | "paste"
  | "quit"
  | "redo"
  | "reload"
  | "resetZoom"
  | "selectAll"
  | "toggleDevTools"
  | "togglefullscreen"
  | "undo"
  | "unhide"
  | "windowMenu"
  | "zoomIn"
  | "zoomOut"

export type DesktopMenuItem = {
  type: "item"
  label?: string
  command?: string
  action?: DesktopMenuAction
  role?: DesktopMenuRole
  href?: string
  accelerator?: Partial<Record<DesktopMenuPlatform, string>>
  enabled?: "updater"
  platforms?: DesktopMenuPlatform[]
}

export type DesktopMenuSeparator = {
  type: "separator"
  platforms?: DesktopMenuPlatform[]
}

export type DesktopMenuEntry = DesktopMenuItem | DesktopMenuSeparator

export type DesktopMenu = {
  id: string
  label: string
  role?: DesktopMenuRole
  items?: DesktopMenuEntry[]
  platforms?: DesktopMenuPlatform[]
}

// OurApp: меню переведено и очищено под продукт «Параграф». Убраны dev-пункты
// opencode (терминал, дерево файлов, открыть/переключить проект, навигация «Go»)
// и ссылки на opencode (docs/discord/github). Бренд — «Параграф».
export const DESKTOP_MENU: DesktopMenu[] = [
  {
    id: "app",
    label: "Параграф",
    platforms: ["macos"],
    items: [
      { type: "item", role: "about" },
      { type: "item", label: "Проверить обновления…", action: "app.checkForUpdates", enabled: "updater" },
      { type: "item", label: "Настройки", command: "settings.open", accelerator: { macos: "Cmd+," } },
      { type: "item", label: "Перезагрузить", action: "view.reload" },
      { type: "item", label: "Перезапустить", action: "app.relaunch" },
      { type: "item", label: "Экспорт логов…", command: "logs.export" },
      { type: "separator" },
      { type: "item", role: "hide" },
      { type: "item", role: "hideOthers" },
      { type: "item", role: "unhide" },
      { type: "separator" },
      { type: "item", role: "quit" },
    ],
  },
  {
    id: "file",
    label: "Файл",
    items: [
      {
        type: "item",
        label: "Новая задача",
        command: "session.new",
        accelerator: { macos: "Shift+Cmd+S" },
      },
      {
        type: "item",
        label: "Настройки",
        command: "settings.open",
        accelerator: { windows: "Ctrl+," },
        platforms: ["windows"],
      },
      {
        type: "item",
        label: "Новое окно",
        action: "window.new",
        accelerator: { macos: "Cmd+Shift+N", windows: "Ctrl+Shift+N" },
      },
      { type: "separator" },
      { type: "item", label: "Закрыть окно", action: "window.close", role: "close" },
    ],
  },
  {
    id: "edit",
    label: "Правка",
    items: [
      { type: "item", label: "Отменить", action: "edit.undo", role: "undo", accelerator: { windows: "Ctrl+Z" } },
      { type: "item", label: "Повторить", action: "edit.redo", role: "redo", accelerator: { windows: "Ctrl+Y" } },
      { type: "separator" },
      { type: "item", label: "Вырезать", action: "edit.cut", role: "cut", accelerator: { windows: "Ctrl+X" } },
      { type: "item", label: "Копировать", action: "edit.copy", role: "copy", accelerator: { windows: "Ctrl+C" } },
      { type: "item", label: "Вставить", action: "edit.paste", role: "paste", accelerator: { windows: "Ctrl+V" } },
      { type: "item", label: "Удалить", action: "edit.delete" },
      {
        type: "item",
        label: "Выделить всё",
        action: "edit.selectAll",
        role: "selectAll",
        accelerator: { windows: "Ctrl+A" },
      },
    ],
  },
  {
    id: "view",
    label: "Вид",
    items: [
      { type: "item", label: "Боковая панель", command: "sidebar.toggle", accelerator: { macos: "Cmd+B" } },
      { type: "separator" },
      { type: "item", label: "Перезагрузить", action: "view.reload", role: "reload" },
      { type: "item", label: "Инструменты разработчика", action: "view.toggleDevTools", role: "toggleDevTools" },
      { type: "separator" },
      {
        type: "item",
        label: "Масштаб 100%",
        action: "view.resetZoom",
        role: "resetZoom",
        accelerator: { windows: "Ctrl+0" },
      },
      { type: "item", label: "Увеличить", action: "view.zoomIn", role: "zoomIn", accelerator: { windows: "Ctrl++" } },
      { type: "item", label: "Уменьшить", action: "view.zoomOut", role: "zoomOut", accelerator: { windows: "Ctrl+-" } },
      { type: "separator" },
      { type: "item", label: "Полноэкранный режим", action: "view.toggleFullscreen", role: "togglefullscreen" },
    ],
  },
  {
    id: "window",
    label: "Окно",
    role: "windowMenu",
    items: [
      { type: "item", label: "Свернуть", action: "window.minimize" },
      { type: "item", label: "Развернуть", action: "window.toggleMaximize" },
      { type: "separator" },
      { type: "item", label: "Закрыть окно", action: "window.close" },
    ],
  },
  {
    id: "help",
    label: "Помощь",
    items: [
      { type: "item", label: "Экспорт логов…", command: "logs.export" },
      { type: "separator" },
      { type: "item", label: "Написать в поддержку", href: "mailto:support@paragraf.app" },
    ],
  },
]

export function desktopMenuVisible(item: { platforms?: DesktopMenuPlatform[] }, platform: DesktopMenuPlatform) {
  return !item.platforms || item.platforms.includes(platform)
}
