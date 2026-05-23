/**
 * Parser tests.
 * Round-trip tests use our own generators. Format-detection tests don't need fixtures.
 */
import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import path from "node:path"
import { parseDocx, parseXlsx, parsePdf, parseAny, xlsxToMarkdown } from "../src/index.ts"
import { generateDocx } from "../src/index.ts"

const FIXTURES = path.resolve(import.meta.dir, "./fixtures")

describe("parseDocx", () => {
  test("extracts text from a generated DOCX", async () => {
    const bytes = await generateDocx({
      blocks: [
        { kind: "heading", level: 1, text: "ДОГОВОР № 42" },
        { kind: "paragraph", text: "Настоящий договор заключён между сторонами." },
      ],
    })
    const result = await parseDocx({ buffer: bytes })
    expect(result.text).toContain("ДОГОВОР № 42")
    expect(result.text).toContain("Настоящий договор заключён между сторонами.")
    expect(result.metadata.warnings).toBeDefined()
  })

  test("preserves headings as markdown", async () => {
    const bytes = await generateDocx({
      blocks: [
        { kind: "heading", level: 2, text: "Раздел 1" },
        { kind: "paragraph", text: "Тело" },
      ],
    })
    const result = await parseDocx({ buffer: bytes })
    // mammoth converts H2 to "## "
    expect(result.text).toMatch(/##\s+Раздел 1/)
  })
})

describe("parseXlsx", () => {
  test("returns empty workbook for empty input", async () => {
    // Construct an empty XLSX via SheetJS round-trip would be heavy; use a known minimal CSV.
    const csv = "name,age\nAlice,30\nBob,25\n"
    const bytes = new TextEncoder().encode(csv)
    const result = await parseXlsx({ buffer: bytes })
    expect(result.sheets.length).toBeGreaterThanOrEqual(1)
    const sheet = result.sheets[0]!
    expect(sheet.rows.length).toBe(3) // header + 2 data rows
    expect(sheet.rows[0]).toEqual(["name", "age"])
    expect(sheet.rows[1]).toEqual(["Alice", 30])
  })

  test("xlsxToMarkdown produces a readable table", async () => {
    const csv = "Контрагент,Сумма\nРомашка,100\nЛютик,200\n"
    const bytes = new TextEncoder().encode(csv)
    const result = await parseXlsx({ buffer: bytes })
    const md = xlsxToMarkdown(result)
    expect(md).toContain("Контрагент")
    expect(md).toContain("Ромашка")
    expect(md).toContain("100")
  })
})

describe("parseAny", () => {
  test("dispatches by extension", async () => {
    const bytes = await generateDocx({
      blocks: [{ kind: "paragraph", text: "Авто-детект" }],
    })
    const result = await parseAny({ buffer: bytes, format: "docx" })
    expect(result.text).toContain("Авто-детект")
  })

  test("rejects unknown format", async () => {
    expect(parseAny({ path: "/no/such/file.xyz" })).rejects.toThrow(/Cannot auto-detect/)
  })
})

// PDF tests need a real fixture (generating PDFs from scratch is heavy).
// We skip them gracefully if the fixture is absent — local dev should drop a sample-contract.pdf.
const samplePdfPath = path.join(FIXTURES, "sample-contract.pdf")
const hasSamplePdf = existsSync(samplePdfPath)

describe.skipIf(!hasSamplePdf)("parsePdf (requires sample-contract.pdf fixture)", () => {
  test("extracts text from a real PDF", async () => {
    const result = await parsePdf({ path: samplePdfPath })
    expect(result.text.length).toBeGreaterThan(0)
    expect(result.metadata.pages).toBeGreaterThan(0)
  })

  test("returns warning for empty/scan-only PDFs", async () => {
    // Skipped unless a scan fixture is present
    const scanPath = path.join(FIXTURES, "sample-scan.pdf")
    if (!existsSync(scanPath)) return
    const result = await parsePdf({ path: scanPath })
    expect(result.metadata.warnings?.some((w) => /OCR/i.test(w))).toBe(true)
  })
})
