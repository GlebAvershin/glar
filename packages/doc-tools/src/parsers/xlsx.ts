/**
 * XLSX/CSV parsing via SheetJS.
 * Returns structured per-sheet rows (header-less, 2-d arrays).
 */
import * as XLSX from "xlsx"
import type { DocSource, ParsedXlsx, ParsedXlsxSheet, XlsxRow } from "../types.ts"
import { loadBytes } from "./loader.ts"

export async function parseXlsx(source: DocSource): Promise<ParsedXlsx> {
  const bytes = await loadBytes(source)

  // Detect XLSX (ZIP-based, starts with PK\x03\x04) vs CSV/TSV (text).
  // For CSV we must decode UTF-8 explicitly — SheetJS's binary path mangles non-ASCII.
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
  const workbook = isZip
    ? XLSX.read(bytes, { type: "array", cellDates: true })
    : XLSX.read(new TextDecoder("utf-8").decode(bytes), { type: "string", cellDates: true })

  const sheets: ParsedXlsxSheet[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    if (!sheet) return { name, rows: [] }
    const rows = XLSX.utils.sheet_to_json<XlsxRow>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    })
    return { name, rows }
  })

  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0)

  return {
    sheets,
    metadata: {
      sheetCount: sheets.length,
      totalRows,
    },
  }
}

/**
 * Convenience: render parsed XLSX as a Markdown table per sheet.
 * Useful for feeding to an LLM.
 */
export function xlsxToMarkdown(parsed: ParsedXlsx, opts: { maxRowsPerSheet?: number } = {}): string {
  const max = opts.maxRowsPerSheet ?? 200
  const parts: string[] = []
  for (const sheet of parsed.sheets) {
    parts.push(`## Лист «${sheet.name}»`)
    if (sheet.rows.length === 0) {
      parts.push("(пусто)")
      continue
    }
    const limited = sheet.rows.slice(0, max)
    const widths = computeColumnWidths(limited)
    parts.push(formatTableRow(limited[0] ?? [], widths))
    parts.push(formatTableSeparator(widths))
    for (const row of limited.slice(1)) {
      parts.push(formatTableRow(row, widths))
    }
    if (sheet.rows.length > max) {
      parts.push(`\n_(показаны первые ${max} строк из ${sheet.rows.length})_`)
    }
  }
  return parts.join("\n\n")
}

function computeColumnWidths(rows: ReadonlyArray<XlsxRow>): number[] {
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length
      widths[i] = Math.max(widths[i] ?? 0, len, 3)
    })
  }
  return widths
}

function formatTableRow(row: XlsxRow, widths: number[]): string {
  return (
    "| " +
    widths
      .map((w, i) => String(row[i] ?? "").padEnd(w, " "))
      .join(" | ") +
    " |"
  )
}

function formatTableSeparator(widths: number[]): string {
  return "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|"
}
