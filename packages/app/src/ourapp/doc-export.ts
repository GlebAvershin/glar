/**
 * OurApp — клиентский экспорт markdown → DOCX.
 *
 * Работает в renderer'е без зависимости от модели. Пользователь может скачать
 * любой ответ ассистента как .docx — независимо от того, поддерживает ли
 * выбранная модель tool-вызовы (GigaChat НЕ поддерживает; Claude/GPT — да).
 *
 * Dynamic import библиотеки `docx` (~600KB) — раздуваем bundle только при
 * первом нажатии «Скачать .docx».
 */

import { openArtifactPreview, type ArtifactInfo } from "./artifact-preview"

/**
 * Зарегистрировать функцию downloadMarkdownAsDocx в глобальном scope, чтобы
 * UI-пакет (без cross-package import'а) мог её вызвать. Вызывается из app.tsx
 * на старте через side-effect.
 */
if (typeof window !== "undefined") {
  ;(window as { ourappDocExport?: typeof downloadMarkdownAsDocx }).ourappDocExport =
    (md: string, opts?: ExportOptions) => downloadMarkdownAsDocx(md, opts ?? {})
}

export interface ExportOptions {
  /** Заголовок документа. Если опущен — берётся первая строка-заголовок из markdown. */
  title?: string
  /** Имя файла (без .docx). Если опущен — слаг из title или "document". */
  filename?: string
  /** Если true — после генерации откроет preview-панель (DOCX → HTML через mammoth). */
  showPreview?: boolean
  /** Если true — не скачивать файл, только показать preview. */
  skipDownload?: boolean
}

/**
 * Главная функция — конвертирует markdown в DOCX, триггерит браузерное скачивание,
 * опционально показывает preview-панель. Возвращает true если успех.
 */
export async function downloadMarkdownAsDocx(
  markdown: string,
  opts: ExportOptions = {},
): Promise<boolean> {
  const trimmed = markdown.trim()
  if (!trimmed) return false

  const title = opts.title ?? extractTitleFromMarkdown(trimmed) ?? "Документ"
  const baseName = opts.filename ?? slugify(title) ?? "document"

  try {
    const docx = await import("docx")
    const cleaned = stripMetaBlocks(trimmed)
    const blocks = markdownToDocxBlocks(cleaned, docx)
    const doc = new docx.Document({
      creator: "Параграф",
      title,
      styles: {
        default: {
          document: {
            run: { font: "Onest", size: 22 }, // 11pt body
          },
        },
        paragraphStyles: [
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            run: { font: "IBM Plex Serif", size: 36, bold: false }, // 18pt
            paragraph: { spacing: { before: 360, after: 180 } },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            run: { font: "IBM Plex Serif", size: 28, bold: false }, // 14pt
            paragraph: { spacing: { before: 280, after: 140 } },
          },
          {
            id: "Heading3",
            name: "Heading 3",
            basedOn: "Normal",
            next: "Normal",
            run: { font: "IBM Plex Serif", size: 24, bold: true }, // 12pt bold
            paragraph: { spacing: { before: 220, after: 110 } },
          },
        ],
      },
      numbering: {
        config: [
          {
            reference: "ourapp-ol",
            levels: [
              {
                level: 0,
                format: docx.LevelFormat.DECIMAL,
                text: "%1.",
                alignment: docx.AlignmentType.START,
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                // A4 standard РФ: 2.5cm = 1417 twips
                top: 1417,
                right: 1417,
                bottom: 1417,
                left: 1417,
              },
            },
          },
          children: blocks,
        },
      ],
    })

    const blob = await docx.Packer.toBlob(doc)
    const fullName = `${baseName}.docx`

    if (!opts.skipDownload) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fullName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }

    if (opts.showPreview) {
      const html = await renderDocxToHtml(blob).catch(() => undefined)
      const blobUrl = URL.createObjectURL(blob)
      const info: ArtifactInfo = {
        filename: fullName,
        path: fullName,
        bytes: blob.size,
        html,
        text: cleaned,
        blobUrl,
      }
      openArtifactPreview(info)
    }

    return true
  } catch (err) {
    console.error("[doc-export] DOCX generation failed", err)
    return false
  }
}

type DocxParaOrTable = import("docx").Paragraph | import("docx").Table

/**
 * Преобразование markdown → docx-блоки.
 * Поддержка: заголовки (# ## ###), параграфы, ul/ol списки, pipe-таблицы,
 * блок-цитаты (> ), кодовые блоки (```), горизонтальная линия.
 * Inline: **bold**, *italic*, `code`.
 */
function markdownToDocxBlocks(md: string, docx: typeof import("docx")): DocxParaOrTable[] {
  const lines = md.split(/\r?\n/)
  const blocks: DocxParaOrTable[] = []
  let i = 0

  const pushParagraph = (text: string, opts: { heading?: 1 | 2 | 3 } = {}) => {
    if (!text.trim()) return
    blocks.push(
      new docx.Paragraph({
        heading: opts.heading
          ? opts.heading === 1
            ? docx.HeadingLevel.HEADING_1
            : opts.heading === 2
              ? docx.HeadingLevel.HEADING_2
              : docx.HeadingLevel.HEADING_3
          : undefined,
        children: renderInlineRuns(text, docx),
      }),
    )
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trimStart()

    // Fenced code block ```
    if (/^```/.test(trimmed)) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i].trimStart())) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence
      if (codeLines.length > 0) {
        blocks.push(
          new docx.Paragraph({
            shading: { type: docx.ShadingType.SOLID, color: "F6F2EB", fill: "F6F2EB" },
            spacing: { before: 120, after: 120 },
            children: [
              new docx.TextRun({
                text: codeLines.join("\n"),
                font: "Consolas",
                size: 20, // 10pt
              }),
            ],
          }),
        )
      }
      continue
    }

    // Pipe table
    if (isTableRow(trimmed)) {
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i].trimStart())) {
        const cells = parsePipeRow(lines[i].trimStart())
        if (cells.every((c) => /^[-:\s]+$/.test(c))) {
          i++
          continue
        }
        rows.push(cells)
        i++
      }
      if (rows.length > 0) {
        blocks.push(buildTable(rows, docx))
      }
      continue
    }

    // Heading H1-H3 (proper docx heading styles)
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (heading) {
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3
      pushParagraph(heading[2], { heading: level })
      i++
      continue
    }

    // Heading H4-H6 → bold paragraph (docx has no built-in H4+ in our styles)
    const subHeading = /^#{4,6}\s+(.+)$/.exec(trimmed)
    if (subHeading) {
      blocks.push(
        new docx.Paragraph({
          spacing: { before: 200, after: 100 },
          children: renderInlineRuns(subHeading[1], docx, { bold: true }),
        }),
      )
      i++
      continue
    }

    // Blockquote
    const bq = /^>\s?(.*)$/.exec(trimmed)
    if (bq) {
      blocks.push(
        new docx.Paragraph({
          indent: { left: 360 },
          border: {
            left: { color: "0B5345", space: 12, style: docx.BorderStyle.SINGLE, size: 12 },
          },
          spacing: { before: 100, after: 100 },
          children: renderInlineRuns(bq[1], docx, { italic: true }),
        }),
      )
      i++
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push(
        new docx.Paragraph({
          border: {
            bottom: { color: "D8D2C5", space: 1, style: docx.BorderStyle.SINGLE, size: 6 },
          },
          children: [],
        }),
      )
      i++
      continue
    }

    // Unordered list item
    const ul = /^[-*+]\s+(.+)$/.exec(trimmed)
    if (ul) {
      blocks.push(
        new docx.Paragraph({
          bullet: { level: 0 },
          children: renderInlineRuns(ul[1], docx),
        }),
      )
      i++
      continue
    }

    // Ordered list item
    const ol = /^(\d+)\.\s+(.+)$/.exec(trimmed)
    if (ol) {
      blocks.push(
        new docx.Paragraph({
          numbering: { reference: "ourapp-ol", level: 0 },
          children: renderInlineRuns(ol[2], docx),
        }),
      )
      i++
      continue
    }

    // Empty line → blank paragraph (preserve spacing)
    if (!trimmed) {
      blocks.push(new docx.Paragraph({ children: [] }))
      i++
      continue
    }

    // Regular paragraph
    pushParagraph(trimmed)
    i++
  }

  return blocks
}

function isTableRow(line: string): boolean {
  return line.startsWith("|") && line.trimEnd().endsWith("|") && line.length > 2
}

function parsePipeRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim())
}

function buildTable(rows: string[][], docx: typeof import("docx")): import("docx").Table {
  const colCount = Math.max(...rows.map((r) => r.length))
  const tableRows = rows.map((row, rowIdx) => {
    const isHeader = rowIdx === 0
    return new docx.TableRow({
      tableHeader: isHeader,
      children: Array.from({ length: colCount }, (_, ci) => {
        const cell = row[ci] ?? ""
        return new docx.TableCell({
          shading: isHeader
            ? { type: docx.ShadingType.SOLID, color: "F6F2EB", fill: "F6F2EB" }
            : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new docx.Paragraph({
              children: renderInlineRuns(String(cell), docx, { bold: isHeader }),
            }),
          ],
        })
      }),
    })
  })
  return new docx.Table({
    rows: tableRows,
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    borders: {
      top: { color: "D8D2C5", size: 4, style: docx.BorderStyle.SINGLE },
      bottom: { color: "D8D2C5", size: 4, style: docx.BorderStyle.SINGLE },
      left: { color: "D8D2C5", size: 4, style: docx.BorderStyle.SINGLE },
      right: { color: "D8D2C5", size: 4, style: docx.BorderStyle.SINGLE },
      insideHorizontal: { color: "D8D2C5", size: 4, style: docx.BorderStyle.SINGLE },
      insideVertical: { color: "D8D2C5", size: 4, style: docx.BorderStyle.SINGLE },
    },
  })
}

/**
 * Inline markdown (bold/italic/code) → docx TextRuns.
 * Базовый стиль (bold/italic) применяется ко всем токенам — для контекста
 * вроде ячеек-заголовков таблицы или блок-цитат.
 */
function renderInlineRuns(
  text: string,
  docx: typeof import("docx"),
  base: { bold?: boolean; italic?: boolean } = {},
): import("docx").TextRun[] {
  const tokens: import("docx").TextRun[] = []
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  const mkRun = (extra: Partial<import("docx").IRunOptions>) =>
    new docx.TextRun({ bold: base.bold, italics: base.italic, ...extra } as import("docx").IRunOptions)

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      tokens.push(mkRun({ text: text.slice(lastIdx, m.index) }))
    }
    const token = m[1]
    if (token.startsWith("**") || token.startsWith("__")) {
      tokens.push(mkRun({ text: token.slice(2, -2), bold: true }))
    } else if (token.startsWith("`")) {
      tokens.push(mkRun({ text: token.slice(1, -1), font: "Consolas" }))
    } else {
      tokens.push(mkRun({ text: token.slice(1, -1), italics: true }))
    }
    lastIdx = pattern.lastIndex
  }

  if (lastIdx < text.length) {
    tokens.push(mkRun({ text: text.slice(lastIdx) }))
  }
  if (tokens.length === 0) {
    tokens.push(mkRun({ text }))
  }
  return tokens
}

/**
 * Убирает технические блоки, которые модель (особенно GigaChat) пишет как текст:
 * "ФАЙЛ", "[filename.docx]", "(Attachement:...)", ссылки на скачивание и т.д.
 */
function stripMetaBlocks(md: string): string {
  // Phase 1: remove inline patterns that GigaChat embeds (may be mid-paragraph)
  let cleaned = md
    // [Filename.docx] — fake attachment link
    .replace(/\[.*?\.docx\]/gi, "")
    // (Attachement:...) or (Attachment:...) — fake download URL
    .replace(/\(Attach[ea]?ment[:%][^)]*\)/gi, "")

  // Phase 2: remove whole lines that are meta-noise
  cleaned = cleaned
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim()
      if (!t) return true
      // "## ФАЙЛ" or "ФАЙЛ" heading
      if (/^#{0,3}\s*ФАЙЛ\s*$/i.test(t)) return false
      // Standalone "Filename.docx" line
      if (/^[\w\sА-Яа-яёЁ\-_.]+\.docx\s*$/i.test(t) && t.length < 120) return false
      // "доступен в формате .docx, прикреплён ниже..."
      if (/доступен в формате\s+\.?docx/i.test(t)) return false
      if (/прикреплён ниже/i.test(t)) return false
      if (/можешь скачать/i.test(t)) return false
      // Line that became empty after phase 1
      if (!t) return false
      return true
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return cleaned
}

function extractTitleFromMarkdown(md: string): string | null {
  const heading = /^#\s+(.+)$/m.exec(md)
  if (heading) return heading[1].trim()
  const firstLine = md.split(/\r?\n/).find((l) => l.trim().length > 0)
  if (firstLine) return firstLine.replace(/^#+\s*/, "").slice(0, 80)
  return null
}

function slugify(s: string): string | null {
  const cleaned = s
    .toLowerCase()
    .replace(/[«»"'„"]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return cleaned || null
}

/**
 * Конвертация DOCX-blob → HTML через mammoth (для preview-панели).
 * Bestеffort: при ошибке возвращает undefined.
 */
async function renderDocxToHtml(blob: Blob): Promise<string | undefined> {
  try {
    const buffer = await blob.arrayBuffer()
    const mammoth = await import("mammoth/mammoth.browser.js" as string)
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
    return result.value
  } catch {
    return undefined
  }
}
