/**
 * DOCX text extraction via `mammoth`.
 * Returns clean Markdown-ish text, preserving headings and lists.
 */
import mammoth from "mammoth"
import type { DocSource, ParsedDoc } from "../types.ts"
import { loadBytes } from "./loader.ts"

/**
 * mammoth.convertToMarkdown exists at runtime but is missing from the
 * shipped .d.ts (see https://github.com/mishoo/mammoth.js/issues/?). Declare
 * the bits we use to satisfy TypeScript without giving up safety entirely.
 */
interface MammothMessage {
  type: string
  message: string
}
interface MammothMarkdownResult {
  value: string
  messages: MammothMessage[]
}
interface MammothWithMarkdown {
  convertToMarkdown(input: { buffer: Buffer }): Promise<MammothMarkdownResult>
}

export async function parseDocx(source: DocSource): Promise<ParsedDoc> {
  const bytes = await loadBytes(source)
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // convertToMarkdown preserves structure (headings, lists, bold) better than extractRawText.
  const result = await (mammoth as unknown as MammothWithMarkdown).convertToMarkdown({ buffer })

  const warnings = result.messages
    .filter((m: MammothMessage) => m.type === "warning" || m.type === "error")
    .map((m: MammothMessage) => m.message)

  // Mammoth aggressively backslash-escapes common punctuation in markdown output
  // (e.g. `.` → `\.`, `-` → `\-`, `!` → `\!`). For LLM consumption these escapes
  // are noise — strip them. Markdown chars that ARE structural (`#`, `*`, `_`, `>`)
  // are preserved.
  const cleaned = result.value.replace(/\\([.\-!?,:;()[\]{}<>+=~`'"])/g, "$1").trim()

  return {
    text: cleaned,
    metadata: {
      warnings,
    },
  }
}
