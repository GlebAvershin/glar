/**
 * Lightweight Markdown → DocxBlock[] converter.
 *
 * Supports the subset that LLMs reliably produce and that legal/accounting
 * documents need:
 *   - # / ## / ### → headings (level 1/2/3)
 *   - empty line → spacer
 *   - other line → paragraph (bold marks `**text**` are stripped to plain;
 *     we don't render mixed-style runs in v0 — that's table-stakes for v1)
 *   - pipe-tables (`| a | b |`) → table block
 *
 * Anything more elaborate (lists, blockquotes, code blocks, inline styles)
 * is rendered as a plain paragraph. Keeps the conversion robust and the
 * Word output predictable.
 */
import type { DocxBlock } from "./types.ts"

export function markdownToBlocks(markdown: string): DocxBlock[] {
  const blocks: DocxBlock[] = []
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ""
    const line = raw.trimEnd()

    // Blank line
    if (line.trim() === "") {
      // Collapse runs of empty lines into one spacer
      if (blocks[blocks.length - 1]?.kind !== "spacer") {
        blocks.push({ kind: "spacer" })
      }
      continue
    }

    // Headings
    const h = /^(#{1,3})\s+(.+)$/.exec(line)
    if (h) {
      const level = h[1]!.length as 1 | 2 | 3
      blocks.push({ kind: "heading", level, text: stripInline(h[2]!) })
      continue
    }

    // Table (consume contiguous pipe-rows)
    if (isTableRow(line)) {
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i]!.trimEnd())) {
        const cells = parseTableRow(lines[i]!.trimEnd())
        // Skip the markdown table separator row like `| --- | --- |`
        if (cells.every((c) => /^[-:\s]+$/.test(c))) {
          i++
          continue
        }
        rows.push(cells)
        i++
      }
      i-- // back off — outer loop will increment
      if (rows.length > 0) blocks.push({ kind: "table", rows })
      continue
    }

    // Paragraph
    blocks.push({ kind: "paragraph", text: stripInline(line) })
  }

  // Trim trailing spacers
  while (blocks.length > 0 && blocks[blocks.length - 1]?.kind === "spacer") {
    blocks.pop()
  }
  return blocks
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith("|") && t.endsWith("|") && t.length > 2
}

function parseTableRow(line: string): string[] {
  const t = line.trim()
  // Strip leading/trailing pipes, split by pipe, trim cells.
  return t
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim())
}

/** Strip simple inline markers (`**bold**`, `*italic*`, ``code``) — keep text only. */
function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
}
