/**
 * OurApp — экспорт сессии чата (ТЗ-05 §5).
 *
 * Собирает всю переписку (user + assistant text parts) → markdown →
 * downloadMarkdownAsDocx или просто .md. Реюзирует doc-export.ts.
 *
 * При экспорте использует РЕАЛЬНЫЕ значения ПДн (они локальные) — маскирование
 * нужно только для исходящего трафика. См. ТЗ-04 §10.
 */
import type { Message, Part, TextPart } from "@opencode-ai/sdk/v2"
import { downloadMarkdownAsDocx } from "./doc-export"

export interface SessionExportInput {
  sessionTitle: string
  sessionDate: Date
  model?: string
  totalCredits?: number
  messages: Message[]
  /** Map: messageID → parts[]. Структура из sync.data.part. */
  partsByMessage: Record<string, Part[] | undefined>
  /** Включить ли служебные сообщения (system, synthetic). */
  includeSystem?: boolean
  /** Включить ли блок метаданных вверху. */
  includeMetadata?: boolean
}

export type ExportFormat = "docx" | "markdown" | "pdf"

/** Собрать markdown переписки. */
export function buildSessionMarkdown(input: SessionExportInput): string {
  const lines: string[] = []

  lines.push(`# Сессия: ${input.sessionTitle}`)
  lines.push("")

  if (input.includeMetadata !== false) {
    const meta: string[] = []
    meta.push(`Дата: ${input.sessionDate.toLocaleString("ru")}`)
    if (input.model) meta.push(`Модель: ${input.model}`)
    if (typeof input.totalCredits === "number") meta.push(`Потрачено: ${input.totalCredits} кредитов`)
    lines.push(`*${meta.join(" · ")}*`)
    lines.push("")
    lines.push("---")
    lines.push("")
  }

  for (const msg of input.messages) {
    const parts = input.partsByMessage[msg.id] ?? []
    const textParts = parts.filter(
      (p): p is TextPart => p.type === "text" && !(p as TextPart).synthetic,
    )
    const text = textParts.map((p) => p.text ?? "").join("\n").trim()
    if (!text) continue

    if (msg.role === "user") {
      lines.push("## Вопрос")
    } else {
      lines.push("## Ответ")
    }
    lines.push("")
    lines.push(text)
    lines.push("")
  }

  return lines.join("\n").trim() + "\n"
}

/** Триггерит браузерное скачивание как .md. */
export function downloadAsMarkdown(input: SessionExportInput): void {
  const md = buildSessionMarkdown(input)
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const fname = `${input.sessionTitle.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "сессия"}.md`
  a.href = url
  a.download = fname
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Экспорт в DOCX через существующий doc-export. */
export async function downloadAsDocx(input: SessionExportInput): Promise<boolean> {
  const md = buildSessionMarkdown(input)
  return downloadMarkdownAsDocx(md, {
    title: input.sessionTitle,
    filename: input.sessionTitle.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "сессия",
  })
}

/** HTML-обёртка переписки для печати/PDF. Кириллица — из системных шрифтов (fallback'и). */
function buildPrintHtml(input: SessionExportInput): string {
  const md = buildSessionMarkdown(input)
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(
    input.sessionTitle,
  )}</title><style>
        @page{margin:18mm;}
        body{font-family:Onest,Arial,sans-serif;line-height:1.55;padding:0;color:#1a1614;font-size:13px;}
        h1{font-family:"IBM Plex Serif",Georgia,serif;font-weight:500;letter-spacing:-0.02em;font-size:24px;}
        h2{font-family:"IBM Plex Serif",Georgia,serif;font-weight:500;margin-top:24px;font-size:19px;}
        h3{font-family:"IBM Plex Serif",Georgia,serif;font-weight:500;margin-top:18px;font-size:16px;}
        h4,h5,h6{font-weight:600;margin-top:14px;font-size:14px;}
        em{color:#5c5852}
        code{font-family:"JetBrains Mono",Consolas,monospace;background:#f6f2eb;padding:1px 4px;border-radius:3px;font-size:12px;}
        hr{border:none;border-top:1px solid #d8d2c5;margin:16px 0}
        ul,ol{margin:8px 0;padding-left:24px;}
        li{margin:3px 0;}
        table{border-collapse:collapse;width:100%;margin:12px 0;font-size:12px;}
        th,td{border:1px solid #d8d2c5;padding:6px 10px;text-align:left;vertical-align:top;}
        th{background:#f6f2eb;font-weight:600;}
        p{margin:8px 0;}
      </style></head><body>${markdownToHtml(md)}</body></html>`
}

/**
 * Печать HTML как PDF через нативный print-движок браузера (скрытый iframe).
 * Юзер получает системный диалог «Сохранить как PDF»: выделяемый текст, корректная
 * кириллица и пагинация — без зависимостей. Имя файла — из <title> документа. iframe
 * (в отличие от window.open) не требует user-gesture → работает после async-загрузки
 * сообщений истории.
 */
function printViaIframe(html: string): boolean {
  if (typeof document === "undefined") return false
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  })
  document.body.appendChild(iframe)
  const cw = iframe.contentWindow
  const doc = cw?.document
  if (!cw || !doc) {
    iframe.remove()
    return false
  }
  doc.open()
  doc.write(html)
  doc.close()
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    try {
      iframe.remove()
    } catch {}
  }
  const run = () => {
    try {
      cw.focus()
      cw.addEventListener?.("afterprint", () => setTimeout(cleanup, 100), { once: true })
      cw.print()
    } catch {
      cleanup()
    }
    setTimeout(cleanup, 60_000)
  }
  if (doc.readyState === "complete") setTimeout(run, 150)
  else iframe.onload = () => setTimeout(run, 150)
  return true
}

/**
 * Экспорт в PDF. Desktop (Electron) — тихое скачивание через webContents.printToPDF.
 * Веб — нативная печать в PDF (системный диалог «Сохранить как PDF»). DOCX — только
 * крайний фолбэк, если ни один путь недоступен (напр. не-браузерная среда).
 */
export async function downloadAsPdf(input: SessionExportInput): Promise<boolean> {
  const html = buildPrintHtml(input)

  // Desktop: тихое скачивание .pdf через Electron preload (api.printToPDF).
  if (typeof window !== "undefined" && "api" in window) {
    const api = (window as { api?: { printToPDF?: (html: string) => Promise<ArrayBuffer | null> } }).api
    if (api?.printToPDF) {
      const buf = await api.printToPDF(html)
      if (buf) {
        const blob = new Blob([buf], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = (input.sessionTitle.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "сессия") + ".pdf"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return true
      }
    }
  }

  // Веб: печать в PDF через системный диалог браузера.
  if (printViaIframe(html)) return true

  // Крайний фолбэк (не-браузерная среда) — DOCX.
  return downloadAsDocx(input)
}

export async function exportSession(input: SessionExportInput, format: ExportFormat): Promise<boolean> {
  if (format === "markdown") {
    downloadAsMarkdown(input)
    return true
  }
  if (format === "docx") return downloadAsDocx(input)
  return downloadAsPdf(input)
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/** Inline markdown → HTML: **bold**, *italic*, `code`. */
function inlineMd(text: string): string {
  let s = escapeHtml(text)
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
  return s
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith("|") && t.endsWith("|") && t.length > 2
}

/** Конверсия markdown → HTML для PDF-печати: заголовки, таблицы, списки, inline. */
function markdownToHtml(md: string): string {
  const lines = md.split("\n")
  const out: string[] = []
  let listType: "ul" | "ol" | null = null

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    // Таблица (pipe) — собираем подряд идущие строки
    if (isTableRow(trimmed)) {
      closeList()
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i]!.trim())) {
        const cells = lines[i]!
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim())
        // Пропускаем разделитель |---|---|
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells)
        i++
      }
      i--
      if (rows.length > 0) {
        out.push("<table>")
        rows.forEach((cells, ri) => {
          const tag = ri === 0 ? "th" : "td"
          out.push("<tr>" + cells.map((c) => `<${tag}>${inlineMd(c)}</${tag}>`).join("") + "</tr>")
        })
        out.push("</table>")
      }
      continue
    }

    // Заголовки H1-H6
    const h = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (h) {
      closeList()
      const level = Math.min(6, h[1]!.length)
      out.push(`<h${level}>${inlineMd(h[2]!)}</h${level}>`)
      continue
    }

    // Горизонтальная линия
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      closeList()
      out.push("<hr/>")
      continue
    }

    // Нумерованный список
    const ol = /^\d+\.\s+(.+)$/.exec(trimmed)
    if (ol) {
      if (listType !== "ol") {
        closeList()
        out.push("<ol>")
        listType = "ol"
      }
      out.push(`<li>${inlineMd(ol[1]!)}</li>`)
      continue
    }

    // Маркированный список
    const ul = /^[-*+]\s+(.+)$/.exec(trimmed)
    if (ul) {
      if (listType !== "ul") {
        closeList()
        out.push("<ul>")
        listType = "ul"
      }
      out.push(`<li>${inlineMd(ul[1]!)}</li>`)
      continue
    }

    // Пустая строка
    if (trimmed === "") {
      closeList()
      continue
    }

    // Обычный параграф
    closeList()
    out.push(`<p>${inlineMd(trimmed)}</p>`)
  }
  closeList()
  return out.join("")
}
