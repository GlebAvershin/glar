/**
 * OurApp — клиентская генерация PDF из markdown (pdfmake).
 *
 * Нужна, чтобы PDF скачивался ТАК ЖЕ молча файлом, как MD и DOCX (без диалога печати).
 * pdfmake рисует настоящий PDF с выделяемым текстом; шрифт по умолчанию Roboto —
 * включает кириллицу. Импорт ленивый (pdfmake + vfs тяжёлые ~1.8 МБ) — тянется только
 * при экспорте в PDF. Парсер markdown — тот же набор, что и в session-export.ts
 * (заголовки, списки, таблицы, hr, inline bold/italic/code).
 */

// Минимальные типы pdfmake (точные не нужны; vfs-сборка без типов).
type PdfRun = { text: string; bold?: boolean; italics?: boolean; color?: string }
type PdfContent = Record<string, unknown>
interface PdfMakeStatic {
  vfs?: Record<string, string>
  addVirtualFileSystem?: (vfs: Record<string, string>) => void
  createPdf: (def: Record<string, unknown>) => { download: (name?: string) => void }
}

export interface PdfExportOptions {
  title: string
  filename: string
}

function escapeNoop(s: string): string {
  return s
}

/** Разбить строку на pdfmake-раны: **bold**, *italic*, `code`. */
function parseInlineRuns(text: string): Array<string | PdfRun> {
  const runs: Array<string | PdfRun> = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(escapeNoop(text.slice(last, m.index)))
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true })
    else if (m[3] !== undefined) runs.push({ text: m[3], italics: true })
    else if (m[4] !== undefined) runs.push({ text: m[4], color: "#7a2d00" })
    last = re.lastIndex
  }
  if (last < text.length) runs.push(escapeNoop(text.slice(last)))
  return runs.length ? runs : [text]
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith("|") && t.endsWith("|") && t.length > 2
}

/** markdown → массив pdfmake-контента. */
function markdownToPdfmake(md: string): PdfContent[] {
  const lines = md.split("\n")
  const out: PdfContent[] = []
  let listBuffer: { type: "ul" | "ol"; items: Array<string | PdfRun>[] } | null = null

  const flushList = () => {
    if (!listBuffer) return
    out.push({ [listBuffer.type]: listBuffer.items, margin: [0, 2, 0, 8] })
    listBuffer = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    // Таблица
    if (isTableRow(trimmed)) {
      flushList()
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i]!.trim())) {
        const cells = lines[i]!
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim())
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells)
        i++
      }
      i--
      if (rows.length > 0) {
        const body = rows.map((cells, ri) =>
          cells.map((c) => ({ text: parseInlineRuns(c), bold: ri === 0, fillColor: ri === 0 ? "#f6f2eb" : undefined })),
        )
        out.push({ table: { headerRows: 1, widths: rows[0]!.map(() => "*"), body }, margin: [0, 6, 0, 10], fontSize: 10 })
      }
      continue
    }

    // Заголовки
    const h = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (h) {
      flushList()
      const level = Math.min(6, h[1]!.length)
      const sizes = [0, 22, 17, 15, 13, 12, 12]
      out.push({
        text: parseInlineRuns(h[2]!),
        bold: true,
        fontSize: sizes[level],
        margin: [0, level <= 2 ? 12 : 8, 0, 4],
      })
      continue
    }

    // Горизонтальная линия
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushList()
      out.push({
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: "#d8d2c5" }],
        margin: [0, 6, 0, 10],
      })
      continue
    }

    // Нумерованный / маркированный список
    const ol = /^\d+\.\s+(.+)$/.exec(trimmed)
    const ul = /^[-*+]\s+(.+)$/.exec(trimmed)
    if (ol || ul) {
      const type = ol ? "ol" : "ul"
      const content = (ol ? ol[1] : ul![1])!
      if (!listBuffer || listBuffer.type !== type) {
        flushList()
        listBuffer = { type, items: [] }
      }
      listBuffer.items.push(parseInlineRuns(content))
      continue
    }

    // Пустая строка
    if (trimmed === "") {
      flushList()
      continue
    }

    // Обычный параграф
    flushList()
    out.push({ text: parseInlineRuns(trimmed), margin: [0, 0, 0, 6] })
  }
  flushList()
  return out
}

/** Сгенерировать PDF из markdown и скачать файлом (молча, как DOCX/MD). */
export async function downloadMarkdownAsPdf(md: string, opts: PdfExportOptions): Promise<boolean> {
  try {
    const [pdfMakeMod, vfsMod] = await Promise.all([
      import("pdfmake/build/pdfmake"),
      import("pdfmake/build/vfs_fonts"),
    ])
    // Динамический импорт: точные типы @types/pdfmake не совпадают с нашим минимальным
    // интерфейсом — мостим через unknown (это явный interop-каст, не `as any`).
    const pmMod = pdfMakeMod as unknown as { default?: PdfMakeStatic } & PdfMakeStatic
    const pdfMake: PdfMakeStatic = pmMod.default ?? pmMod
    const vfMod = vfsMod as unknown as { default?: Record<string, string> } & Record<string, string>
    const vfs: Record<string, string> = vfMod.default ?? vfMod
    if (typeof pdfMake.addVirtualFileSystem === "function") pdfMake.addVirtualFileSystem(vfs)
    else pdfMake.vfs = vfs

    const docDefinition: Record<string, unknown> = {
      info: { title: opts.title },
      pageMargins: [50, 50, 50, 55],
      defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.3, color: "#1a1614" },
      content: markdownToPdfmake(md),
      footer: (currentPage: number, pageCount: number) => ({
        text: `${currentPage} / ${pageCount}`,
        alignment: "center",
        fontSize: 9,
        color: "#9b958a",
        margin: [0, 8, 0, 0],
      }),
    }

    const safe = opts.filename.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "сессия"
    pdfMake.createPdf(docDefinition).download(safe + ".pdf")
    return true
  } catch (err) {
    console.warn("[pdf] generation failed", err)
    return false
  }
}
