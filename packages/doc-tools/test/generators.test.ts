/**
 * DOCX generator tests.
 * Uses the round-trip approach: generate a DOCX, then parse it back with our own parser.
 * No external fixtures required.
 */
import { describe, expect, test } from "bun:test"
import { generateDocx, parseDocx } from "../src/index.ts"
import type { DocxBlock } from "../src/types.ts"

describe("generateDocx", () => {
  test("produces a valid DOCX (ZIP signature)", async () => {
    const bytes = await generateDocx({
      title: "Тест",
      blocks: [{ kind: "paragraph", text: "Привет" }],
    })
    // DOCX is a ZIP — first 4 bytes are 'PK\x03\x04'.
    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(bytes[0]).toBe(0x50) // P
    expect(bytes[1]).toBe(0x4b) // K
    expect(bytes[2]).toBe(0x03)
    expect(bytes[3]).toBe(0x04)
  })

  test("round-trip: generated paragraphs are recovered by parser", async () => {
    const blocks: DocxBlock[] = [
      { kind: "heading", level: 1, text: "Заголовок документа" },
      { kind: "paragraph", text: "Первый параграф основного текста." },
      { kind: "spacer" },
      { kind: "paragraph", text: "Второй параграф." },
    ]
    const bytes = await generateDocx({ title: "RT", blocks })
    const parsed = await parseDocx({ buffer: bytes })

    expect(parsed.text).toContain("Заголовок документа")
    expect(parsed.text).toContain("Первый параграф основного текста.")
    expect(parsed.text).toContain("Второй параграф.")
  })

  test("round-trip: generated table is recovered with all cells", async () => {
    const blocks: DocxBlock[] = [
      { kind: "heading", level: 2, text: "Таблица" },
      {
        kind: "table",
        rows: [
          ["№", "Контрагент", "Сумма"],
          ["1", "ООО Ромашка", "100 000"],
          ["2", "ИП Иванов", "50 000"],
        ],
      },
    ]
    const bytes = await generateDocx({ blocks })
    const parsed = await parseDocx({ buffer: bytes })

    expect(parsed.text).toContain("Контрагент")
    expect(parsed.text).toContain("ООО Ромашка")
    expect(parsed.text).toContain("100 000")
    expect(parsed.text).toContain("ИП Иванов")
  })

  test("empty spec still produces a valid file", async () => {
    const bytes = await generateDocx({ blocks: [] })
    expect(bytes.byteLength).toBeGreaterThan(0)
  })
})
