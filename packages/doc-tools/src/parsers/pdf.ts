/**
 * PDF text extraction via `unpdf` (Bun-friendly, pure JS, no native deps).
 *
 * Limitations:
 *  - Text-only PDFs only. Scanned PDFs need OCR (Phase 2: tesseract.js).
 *  - Layout heuristics are basic; complex tables may come out flat.
 */
import { extractText, getDocumentProxy } from "unpdf"
import type { DocSource, ParsedDoc } from "../types.ts"
import { loadBytes } from "./loader.ts"

export async function parsePdf(source: DocSource): Promise<ParsedDoc> {
  const bytes = await loadBytes(source)
  const pdf = await getDocumentProxy(bytes)
  const { text, totalPages } = await extractText(pdf, { mergePages: false })

  const pages = Array.isArray(text) ? text : [text]
  const formatted = pages
    .map((page, i) => {
      const cleaned = page.replace(/\s+\n/g, "\n").trim()
      return cleaned ? `## Страница ${i + 1}\n\n${cleaned}` : `## Страница ${i + 1}\n\n(пусто)`
    })
    .join("\n\n")

  const warnings: string[] = []
  if (formatted.trim().length === 0) {
    warnings.push("PDF не содержит извлекаемого текста (возможно, скан-копия — нужен OCR)")
  }

  return {
    text: formatted,
    metadata: {
      pages: totalPages,
      warnings,
    },
  }
}
