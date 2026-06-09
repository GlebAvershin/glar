/**
 * OurApp — страница «История сессий» (ТЗ-05 §4).
 *
 * Список всех сессий со всех проектов пользователя, сгруппированных по дате.
 * Поиск по заголовку (полнотекстовый по сообщениям — Phase 2 после уроков от
 * полей usage_events). Действия: открыть, экспорт.
 *
 * Источник данных — sync.data через globalSync (НЕ дублируем хранилище opencode).
 */
import { For, Show, createMemo, createSignal, type Component } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { useGlobalSync } from "@/context/global-sync"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLayout } from "@/context/layout"
import { sortedRootSessions } from "@/pages/layout/helpers"
import { sessionTitle } from "@/utils/session-title"
import { exportSession, type ExportFormat } from "@/ourapp/session-export"
import type { Part } from "@opencode-ai/sdk/v2"
import "./history.css"

interface HistoryRow {
  id: string
  directory: string
  title: string
  preview: string
  updatedAt: number
  createdAt: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function bucketLabel(now: number, ts: number): string {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const day = today.getTime()
  const yest = day - DAY_MS
  const weekStart = day - 6 * DAY_MS
  if (ts >= day) return "Сегодня"
  if (ts >= yest) return "Вчера"
  if (ts >= weekStart) return "На этой неделе"
  return "Раньше"
}

const BUCKET_ORDER = ["Сегодня", "Вчера", "На этой неделе", "Раньше"] as const

export const HistoryPage: Component = () => {
  const navigate = useNavigate()
  const layout = useLayout()
  const globalSync = useGlobalSync()
  const globalSDK = useGlobalSDK()
  const [search, setSearch] = createSignal("")

  // Все сессии из всех проектов пользователя.
  const allSessions = createMemo<HistoryRow[]>(() => {
    const projects = layout.projects.list()
    if (projects.length === 0) return []
    const now = Date.now()
    const all: HistoryRow[] = []
    for (const project of projects) {
      const directories = [project.worktree, ...(project.sandboxes ?? [])]
      for (const dir of directories) {
        const stores = globalSync.child(dir, { bootstrap: false })
        const store = stores[0]
        if (!store) continue
        for (const s of sortedRootSessions(store, now)) {
          all.push({
            id: s.id,
            directory: s.directory,
            title: sessionTitle(s.title) || "Без названия",
            preview: s.title || "",
            updatedAt: s.time.updated ?? s.time.created,
            createdAt: s.time.created,
          })
        }
      }
    }
    // Дедуп по id.
    const seen = new Set<string>()
    return all.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
  })

  const filtered = createMemo<HistoryRow[]>(() => {
    const q = search().trim().toLowerCase()
    if (!q) return allSessions()
    return allSessions().filter(
      (r) => r.title.toLowerCase().includes(q) || r.preview.toLowerCase().includes(q),
    )
  })

  const buckets = createMemo(() => {
    const now = Date.now()
    const groups = new Map<string, HistoryRow[]>()
    for (const row of filtered()) {
      const label = bucketLabel(now, row.updatedAt)
      const arr = groups.get(label) ?? []
      arr.push(row)
      groups.set(label, arr)
    }
    return BUCKET_ORDER.filter((label) => (groups.get(label)?.length ?? 0) > 0).map((label) => ({
      label,
      items: groups.get(label) ?? [],
    }))
  })

  const formatDate = (ts: number): string => {
    return new Date(ts).toLocaleString("ru", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const open = (row: HistoryRow) => {
    navigate(`/${base64Encode(row.directory)}/session/${row.id}`)
  }

  const handleExport = async (row: HistoryRow, format: ExportFormat) => {
    try {
      // Сессии в истории lazy-loaded — сообщений нет в sync-store, пока сессия
      // не открыта. Подгружаем их по требованию через HTTP-клиент.
      const res = await globalSDK.client.session.messages({
        directory: row.directory,
        sessionID: row.id,
        limit: 1000,
      })
      const items = (res.data ?? []).filter((x) => !!x?.info?.id)
      const messages = items.map((x) => x.info)
      const partsByMessage: Record<string, Part[]> = {}
      for (const x of items) partsByMessage[x.info.id] = x.parts

      const ok = await exportSession(
        {
          sessionTitle: row.title,
          sessionDate: new Date(row.updatedAt),
          messages,
          partsByMessage,
          includeMetadata: true,
        },
        format,
      )
      if (!ok) alert("Не удалось экспортировать сессию")
    } catch (err) {
      console.error("[export] failed", err)
      alert("Не удалось загрузить сообщения сессии для экспорта")
    }
  }

  return (
    <div class="ourapp-history">
      <header class="ourapp-history__topbar">
        <button type="button" class="ourapp-settings__back" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div class="ourapp-settings__crumb">История сессий</div>
      </header>

      <main class="ourapp-history__main">
        <div class="ourapp-history__head">
          <h1 class="ourapp-history__title">
            <em>История</em> сессий
          </h1>
          <input
            type="search"
            class="ourapp-history__search"
            placeholder="Поиск по заголовку…"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>

        <Show
          when={buckets().length > 0}
          fallback={
            <div class="ourapp-history__empty">
              {search() ? "Ничего не найдено по запросу." : "Сессий пока нет. Начните новую."}
            </div>
          }
        >
          <For each={buckets()}>
            {(bucket) => (
              <section class="ourapp-history__bucket">
                <h2 class="ourapp-history__bucketTitle">{bucket.label}</h2>
                <ul class="ourapp-history__list">
                  <For each={bucket.items}>
                    {(row) => (
                      <li class="ourapp-history__item">
                        <button
                          type="button"
                          class="ourapp-history__cardBtn"
                          onClick={() => open(row)}
                        >
                          <div class="ourapp-history__cardTitle">{row.title}</div>
                          <Show when={row.preview && row.preview !== row.title}>
                            <div class="ourapp-history__cardPreview">{row.preview}</div>
                          </Show>
                          <div class="ourapp-history__cardMeta">
                            <span>{formatDate(row.updatedAt)}</span>
                          </div>
                        </button>
                        <div class="ourapp-history__actions">
                          <button
                            type="button"
                            class="ourapp-history__action"
                            onClick={() => handleExport(row, "docx")}
                            title="Экспорт в Word"
                          >
                            DOCX
                          </button>
                          <button
                            type="button"
                            class="ourapp-history__action"
                            onClick={() => handleExport(row, "markdown")}
                            title="Экспорт в Markdown"
                          >
                            MD
                          </button>
                          <button
                            type="button"
                            class="ourapp-history__action"
                            onClick={() => handleExport(row, "pdf")}
                            title="Экспорт в PDF"
                          >
                            PDF
                          </button>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </For>
        </Show>
      </main>
    </div>
  )
}

export default HistoryPage
