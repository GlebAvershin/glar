export { parsePdf } from "./pdf.ts"
export { parseDocx } from "./docx.ts"
export { parseXlsx, xlsxToMarkdown } from "./xlsx.ts"

import type { DocSource, ParsedDoc } from "../types.ts"
import { parsePdf } from "./pdf.ts"
import { parseDocx } from "./docx.ts"
import { parseXlsx, xlsxToMarkdown } from "./xlsx.ts"

/**
 * Auto-detect format by extension or magic bytes and dispatch.
 * Returns text-only ParsedDoc — XLSX is rendered as Markdown tables for LLM consumption.
 */
export async function parseAny(source: DocSource & { format?: "pdf" | "docx" | "xlsx" }): Promise<ParsedDoc> {
  const fmt = source.format ?? detectFormat(source)
  switch (fmt) {
    case "pdf":
      return parsePdf(source)
    case "docx":
      return parseDocx(source)
    case "xlsx": {
      const parsed = await parseXlsx(source)
      return {
        text: xlsxToMarkdown(parsed),
        metadata: {
          pages: parsed.sheets.length,
        },
      }
    }
    default:
      throw new Error(`Unsupported document format: ${fmt}`)
  }
}

function detectFormat(source: { path?: string }): "pdf" | "docx" | "xlsx" {
  if (source.path) {
    const lower = source.path.toLowerCase()
    if (lower.endsWith(".pdf")) return "pdf"
    if (lower.endsWith(".docx")) return "docx"
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "xlsx"
  }
  throw new Error("Cannot auto-detect format — pass `format` explicitly or use a recognized extension")
}
