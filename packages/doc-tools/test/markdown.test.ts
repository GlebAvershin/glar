/**
 * Tests for markdown → DocxBlock[] converter + round-trip with parser.
 */
import { describe, expect, test } from "bun:test"
import { markdownToBlocks } from "../src/markdown-to-blocks.ts"
import { generateDocx } from "../src/generators/index.ts"
import { parseDocx } from "../src/parsers/index.ts"

describe("markdownToBlocks", () => {
  test("plain paragraph", () => {
    const blocks = markdownToBlocks("Just a sentence.")
    expect(blocks).toEqual([{ kind: "paragraph", text: "Just a sentence." }])
  })

  test("headings at three levels", () => {
    const blocks = markdownToBlocks("# H1\n## H2\n### H3")
    expect(blocks).toEqual([
      { kind: "heading", level: 1, text: "H1" },
      { kind: "heading", level: 2, text: "H2" },
      { kind: "heading", level: 3, text: "H3" },
    ])
  })

  test("collapses multiple blank lines into single spacer", () => {
    const blocks = markdownToBlocks("First\n\n\n\nSecond")
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toEqual({ kind: "paragraph", text: "First" })
    expect(blocks[1]).toEqual({ kind: "spacer" })
    expect(blocks[2]).toEqual({ kind: "paragraph", text: "Second" })
  })

  test("strips inline emphasis", () => {
    const blocks = markdownToBlocks("plain **bold** and *italic* and `code`")
    expect(blocks[0]).toEqual({ kind: "paragraph", text: "plain bold and italic and code" })
  })

  test("pipe table (with separator row)", () => {
    const md = ["| № | Контрагент | Сумма |", "| --- | --- | --- |", "| 1 | ООО Ромашка | 100 |"].join(
      "\n",
    )
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({
      kind: "table",
      rows: [
        ["№", "Контрагент", "Сумма"],
        ["1", "ООО Ромашка", "100"],
      ],
    })
  })

  test("trailing spacers trimmed", () => {
    const blocks = markdownToBlocks("Hello\n\n\n")
    expect(blocks).toEqual([{ kind: "paragraph", text: "Hello" }])
  })
})

describe("markdown → DOCX round-trip via plugin path", () => {
  test("renders heading + paragraph + table that parser recovers", async () => {
    const md = [
      "# ПРЕТЕНЗИЯ",
      "",
      "В адрес ООО «Ромашка».",
      "",
      "## Расчёт суммы",
      "",
      "| № | Описание | Сумма |",
      "| --- | --- | --- |",
      "| 1 | Просрочка поставки | 50 000 |",
      "| 2 | Штраф по договору | 25 000 |",
    ].join("\n")

    const blocks = markdownToBlocks(md)
    const bytes = await generateDocx({ title: "Test", blocks })
    const parsed = await parseDocx({ buffer: bytes })

    // Heading text recovered
    expect(parsed.text).toContain("ПРЕТЕНЗИЯ")
    expect(parsed.text).toContain("Расчёт суммы")
    // Paragraph text recovered
    expect(parsed.text).toContain("В адрес ООО «Ромашка»")
    // Table cells recovered
    expect(parsed.text).toContain("Просрочка поставки")
    expect(parsed.text).toContain("50 000")
    expect(parsed.text).toContain("Штраф по договору")
    expect(parsed.text).toContain("25 000")
  })
})
