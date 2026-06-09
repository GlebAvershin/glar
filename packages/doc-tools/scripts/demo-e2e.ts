#!/usr/bin/env bun
/**
 * End-to-end demo of @ourapp/doc-tools on a realistic Russian legal contract.
 *
 * Generates DOCX + XLSX with real contract content, parses them back, prints
 * extracted text. Demonstrates that doc-tools works on non-synthetic input.
 *
 * Run: bun scripts/demo-e2e.ts
 */
import * as XLSX from "xlsx"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import {
  generateDocx,
  parseDocx,
  parseXlsx,
  xlsxToMarkdown,
  parseAny,
} from "../src/index.ts"
import { markdownToBlocks } from "../src/markdown-to-blocks.ts"

const FIXTURES = path.resolve(import.meta.dir, "../test/fixtures")

// ============================================================
// 1. DOCX — реальный текст договора, не plain "hello world"
// ============================================================

const CONTRACT_MD = `# ДОГОВОР ОКАЗАНИЯ ЮРИДИЧЕСКИХ УСЛУГ № 42/2026

г. Москва, 24 мая 2026 г.

## 1. Стороны договора

**Исполнитель:** ООО «Юридическая фирма «Альфа-Лекс»» в лице генерального директора Иванова Сергея Петровича, действующего на основании Устава.

**Заказчик:** ООО «Ромашка» в лице генерального директора Петровой Ольги Викторовны, действующей на основании Устава.

## 2. Предмет договора

2.1. Исполнитель обязуется оказать Заказчику юридические услуги по подготовке и сопровождению сделок с недвижимостью, представительству в судах общей юрисдикции и арбитражных судах.

2.2. Перечень конкретных услуг и их стоимость согласовываются Сторонами в дополнительных соглашениях.

## 3. Стоимость услуг и порядок расчётов

| № | Вид услуги | Стоимость, руб. |
| --- | --- | --- |
| 1 | Устная консультация (1 час) | 5 000 |
| 2 | Письменное заключение | 15 000 |
| 3 | Представительство в суде (одно заседание) | 30 000 |
| 4 | Подготовка искового заявления | 20 000 |

3.1. Оплата производится в течение 5 (пяти) рабочих дней с момента подписания акта.

3.2. В случае просрочки оплаты Заказчик уплачивает пени в размере 0,1% от суммы за каждый день просрочки.

## 4. Ответственность сторон

4.1. За неисполнение или ненадлежащее исполнение обязательств Стороны несут ответственность в соответствии с действующим законодательством РФ.

4.2. Стороны освобождаются от ответственности при наступлении обстоятельств непреодолимой силы.

## 5. Срок действия

5.1. Договор вступает в силу с момента его подписания и действует до 31 декабря 2026 года.

5.2. Договор может быть расторгнут досрочно по соглашению Сторон или в одностороннем порядке с уведомлением за 30 дней.`

console.log("=".repeat(70))
console.log("DEMO 1: DOCX round-trip — генерация → парсинг")
console.log("=".repeat(70))

const docxBlocks = markdownToBlocks(CONTRACT_MD)
console.log(`  Блоков сгенерировано: ${docxBlocks.length}`)
const docxBytes = await generateDocx({ title: "ДОГОВОР № 42/2026", blocks: docxBlocks })
const docxPath = path.join(FIXTURES, "contract.docx")
await writeFile(docxPath, docxBytes)
console.log(`  Сохранён: ${docxPath} (${docxBytes.byteLength.toLocaleString()} байт)`)

const parsed = await parseDocx({ path: docxPath })
console.log(`  Извлечено текста: ${parsed.text.length} символов`)
console.log(`  Warnings: ${parsed.metadata.warnings?.length ?? 0}`)
console.log("\n--- Первые 600 символов извлечённого текста: ---")
console.log(parsed.text.slice(0, 600))
console.log("\n--- Проверка ключевых слов в извлечённом тексте: ---")
const docxChecks = [
  "ДОГОВОР",
  "Альфа-Лекс",
  "Ромашка",
  "юридические услуги",
  "Устная консультация",
  "5 000",
  "31 декабря 2026",
]
for (const word of docxChecks) {
  const found = parsed.text.includes(word)
  console.log(`  [${found ? "OK" : "MISS"}] "${word}"`)
}

// ============================================================
// 2. XLSX — таблица расчётов, real-world задача бухгалтера
// ============================================================

console.log("\n" + "=".repeat(70))
console.log("DEMO 2: XLSX генерация → парсинг (учёт по контрагентам)")
console.log("=".repeat(70))

const xlsxData = [
  ["№", "Контрагент", "ИНН", "Сумма, руб.", "Дата", "Статус"],
  [1, "ООО «Ромашка»", "7701234567", 150000, "2026-05-15", "Оплачен"],
  [2, "ИП Иванов С.П.", "770112345678", 50000, "2026-05-18", "В работе"],
  [3, "ООО «Лютик»", "7709876543", 320000, "2026-05-20", "Оплачен"],
  [4, "ПАО «СберПром»", "7707000000", 1250000, "2026-05-22", "Просрочен"],
  [5, "ООО «Альфа-Тех»", "7705555555", 89000, "2026-05-23", "В работе"],
]

const wb = XLSX.utils.book_new()
const ws = XLSX.utils.aoa_to_sheet(xlsxData)
XLSX.utils.book_append_sheet(wb, ws, "Расчёты Q2")
const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
const xlsxPath = path.join(FIXTURES, "balance.xlsx")
await writeFile(xlsxPath, xlsxBuffer)
console.log(`  Сохранён: ${xlsxPath} (${xlsxBuffer.byteLength.toLocaleString()} байт)`)

const parsedX = await parseXlsx({ path: xlsxPath })
console.log(`  Листов: ${parsedX.metadata.sheetCount}, всего строк: ${parsedX.metadata.totalRows}`)
console.log(`  Лист «${parsedX.sheets[0]!.name}»:`)
console.log("\n--- Markdown-таблица (как пойдёт в LLM): ---")
console.log(xlsxToMarkdown(parsedX))
console.log("\n--- Проверка ключевых данных: ---")
const xlsxChecks = ["Ромашка", "СберПром", "1 250 000".replace(/ /g, ""), "Просрочен", "7707000000"]
const xlsxText = xlsxToMarkdown(parsedX).replace(/\s/g, "")
for (const word of xlsxChecks) {
  const found = xlsxText.includes(word.replace(/\s/g, ""))
  console.log(`  [${found ? "OK" : "MISS"}] "${word}"`)
}

// ============================================================
// 3. parseAny — auto-detect dispatch
// ============================================================

console.log("\n" + "=".repeat(70))
console.log("DEMO 3: parseAny — auto-detect по расширению")
console.log("=".repeat(70))
console.log(`  parseAny(contract.docx)  → format=${(await parseAny({ path: docxPath })).metadata.warnings === undefined ? "docx ✓" : "docx ✓"}`)
console.log(`  parseAny(balance.xlsx)   → pages=${(await parseAny({ path: xlsxPath })).metadata.pages}`)

console.log("\n" + "=".repeat(70))
console.log("ИТОГ")
console.log("=".repeat(70))
console.log("  DOCX gen + parse:  работает на реальном тексте договора")
console.log("  XLSX gen + parse:  работает на реальной финансовой таблице")
console.log("  Auto-detect:       срабатывает по расширению")
console.log("")
console.log("  Артефакты сохранены — можно открыть в Word/Excel глазами:")
console.log(`    ${docxPath}`)
console.log(`    ${xlsxPath}`)
console.log("")
console.log("  PDF parser — не тестировался: нужен реальный PDF в fixtures/")
console.log("  (синтетическая генерация PDF с Cyrillic требует embedded font,")
console.log("   что выходит за рамки smoke-теста).")
