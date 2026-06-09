/**
 * Генерация иконок приложения «Параграф» из SVG-исходника.
 *
 * Вход:  icons/paragraf-source.svg (§ на emerald-squircle)
 * Выход: раскладывается в icons/dev, icons/prod, icons/beta (copy-icons.ts
 *        копирует нужный channel → resources/icons при сборке) и напрямую в
 *        resources/icons для dev-режима.
 *
 * Полный набор (как у opencode-форка):
 *   - icon.ico (Windows), icon.icns (macOS)
 *   - 32/64/128 px + 128@2x (256)
 *   - Square{30,107,142,150,284,310}Logo.png (Windows Store tiles)
 *
 * Запуск: bun run scripts/generate-icons.ts
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import png2icons from "png2icons"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ICONS_DIR = join(__dirname, "..", "icons")
const RESOURCES_ICONS = join(__dirname, "..", "resources", "icons")
const SRC = join(ICONS_DIR, "paragraf-source.svg")

// channel-папки + прямой resources/icons (для dev без сборки)
const TARGETS = [
  join(ICONS_DIR, "dev"),
  join(ICONS_DIR, "prod"),
  join(ICONS_DIR, "beta"),
  RESOURCES_ICONS,
]

// Стандартные PNG: имя → размер
const PNG_FILES: Record<string, number> = {
  "32x32.png": 32,
  "64x64.png": 64,
  "128x128.png": 128,
  "128x128@2x.png": 256,
}

// Windows Store tiles: имя → размер
const SQUARE_FILES: Record<string, number> = {
  "Square30x30Logo.png": 30,
  "Square107x107Logo.png": 107,
  "Square142x142Logo.png": 142,
  "Square150x150Logo.png": 150,
  "Square284x284Logo.png": 284,
  "Square310x310Logo.png": 310,
}

async function renderPng(master: Buffer, size: number): Promise<Buffer> {
  return await sharp(master).resize(size, size).png().toBuffer()
}

async function main() {
  // Мастер PNG 1024 из SVG (density повыше для чёткого serif §).
  const master = await sharp(SRC, { density: 384 }).resize(1024, 1024).png().toBuffer()

  // ico/icns из мастера (одинаковы для всех каналов).
  const ico = png2icons.createICO(master, png2icons.BILINEAR, 0, false, true)
  const icns = png2icons.createICNS(master, png2icons.BILINEAR, 0)
  if (!ico || !icns) throw new Error("ICO/ICNS generation failed")

  // Предрендерим все PNG один раз.
  const pngCache = new Map<string, Buffer>()
  for (const [name, size] of [...Object.entries(PNG_FILES), ...Object.entries(SQUARE_FILES)]) {
    pngCache.set(name, await renderPng(master, size))
  }

  for (const dir of TARGETS) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "icon.ico"), ico)
    writeFileSync(join(dir, "icon.icns"), icns)
    for (const [name, buf] of pngCache) {
      writeFileSync(join(dir, name), buf)
    }
    console.log(`  ✓ ${dir.replace(join(__dirname, ".."), ".")}`)
  }

  console.log("\nИконки «Параграфа» сгенерированы и разложены по каналам.")
}

main().catch((err) => {
  console.error("Icon generation failed:", err)
  process.exit(1)
})
