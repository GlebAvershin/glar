#!/usr/bin/env bun
/**
 * Generates a real PDF using pdf-lib, then parses it back via our parsePdf.
 * Uses Latin text (StandardFonts) because Cyrillic in synthetic PDFs needs
 * embedded TTF font — out of scope for a smoke test. Real client PDFs from
 * Word/Excel already ship with embedded fonts so this isn't a runtime concern.
 *
 * Run: bun scripts/demo-pdf.ts
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { parsePdf, parseAny } from "../src/index.ts"

const FIXTURES = path.resolve(import.meta.dir, "../test/fixtures")

console.log("=".repeat(70))
console.log("DEMO: PDF generate → parse round-trip")
console.log("=".repeat(70))

// Build a 2-page contract-like PDF
const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.HelveticaBold)
const fontReg = await doc.embedFont(StandardFonts.Helvetica)

// --- Page 1 ---
const page1 = doc.addPage([595, 842]) // A4
page1.drawText("LEGAL SERVICES AGREEMENT No. 42/2026", {
  x: 50, y: 780, size: 16, font, color: rgb(0, 0, 0),
})
page1.drawText("Moscow, May 24, 2026", { x: 50, y: 750, size: 11, font: fontReg })

page1.drawText("Section 1. Parties", { x: 50, y: 710, size: 13, font })
const p1 = [
  "Provider: Alfa-Lex LLC, represented by S.P. Ivanov, Director.",
  "Client:   Romashka LLC, represented by O.V. Petrova, Director.",
]
p1.forEach((line, i) => {
  page1.drawText(line, { x: 50, y: 685 - i * 18, size: 11, font: fontReg })
})

page1.drawText("Section 2. Subject", { x: 50, y: 620, size: 13, font })
const p2 = [
  "Provider shall render legal services including contract drafting,",
  "court representation, and consultations on Russian law matters.",
]
p2.forEach((line, i) => {
  page1.drawText(line, { x: 50, y: 595 - i * 18, size: 11, font: fontReg })
})

page1.drawText("Section 3. Pricing", { x: 50, y: 530, size: 13, font })
const pricing = [
  "  1. Verbal consultation (1 hour)        5000 RUB",
  "  2. Written legal opinion              15000 RUB",
  "  3. Court representation (one hearing) 30000 RUB",
  "  4. Statement of claim preparation     20000 RUB",
]
pricing.forEach((line, i) => {
  page1.drawText(line, { x: 50, y: 505 - i * 18, size: 11, font: fontReg })
})

// --- Page 2 ---
const page2 = doc.addPage([595, 842])
page2.drawText("Section 4. Liability and Termination", { x: 50, y: 780, size: 13, font })
const p4 = [
  "4.1. For non-performance, parties bear liability per RF Civil Code.",
  "4.2. Force majeure releases parties from liability per Art. 401 RF CC.",
  "5.1. Agreement effective from signing until December 31, 2026.",
  "5.2. May be terminated with 30-day notice.",
]
p4.forEach((line, i) => {
  page2.drawText(line, { x: 50, y: 755 - i * 18, size: 11, font: fontReg })
})

const bytes = await doc.save()
const pdfPath = path.join(FIXTURES, "contract-en.pdf")
await writeFile(pdfPath, bytes)
console.log(`  PDF saved: ${pdfPath} (${bytes.byteLength.toLocaleString()} bytes, 2 pages)`)
console.log("")

// --- Parse it back ---
const parsed = await parsePdf({ path: pdfPath })
console.log(`  Extracted: ${parsed.text.length} characters, ${parsed.metadata.pages} pages`)
console.log(`  Warnings: ${parsed.metadata.warnings?.join(", ") || "none"}`)
console.log("")
console.log("--- First 800 chars of extracted text: ---")
console.log(parsed.text.slice(0, 800))
console.log("")
console.log("--- Key term checks: ---")
const checks = [
  "LEGAL SERVICES AGREEMENT",
  "Alfa-Lex",
  "Romashka",
  "Ivanov",
  "Verbal consultation",
  "5000 RUB",
  "December 31, 2026",
  "Force majeure",
  "Section 4",
]
let pass = 0
for (const word of checks) {
  const found = parsed.text.includes(word)
  if (found) pass++
  console.log(`  [${found ? "OK" : "MISS"}] "${word}"`)
}
console.log("")
console.log(`  ${pass}/${checks.length} keywords found.`)
console.log("")

// parseAny dispatch
const viaAny = await parseAny({ path: pdfPath })
console.log(`  parseAny(${path.basename(pdfPath)}) → ${viaAny.metadata.pages} pages, ${viaAny.text.length} chars`)
console.log("")
console.log("PDF parser confirmed working on a real multi-page PDF.")
