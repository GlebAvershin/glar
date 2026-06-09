/**
 * OurApp — browser-friendly парсер документов.
 *
 * @ourapp/doc-tools работает с Node Buffer (для серверного / Electron-main
 * использования). В renderer'е удобнее динамически импортировать mammoth/xlsx
 * с ArrayBuffer.
 *
 * Используется в composer перед прикреплением: DOCX/XLSX парсится локально
 * и вставляется как plain-text content в prompt — тогда любая модель (включая
 * GigaChat без document API) видит содержимое документа.
 */

export interface ParsedDocLocal {
  text: string
  filename: string
  pages?: number
  warning?: string
}

/**
 * Распарсить DOCX/XLSX/CSV/PDF в plain-text.
 * PDF парсим через unpdf (pure JS, без native deps) — работает в renderer.
 */
export async function parseOfficeDocumentLocally(file: File): Promise<ParsedDocLocal | null> {
  const name = file.name
  const lower = name.toLowerCase()
  const buffer = await file.arrayBuffer()

  if (lower.endsWith(".pdf")) {
    return parsePdfBrowser(buffer, name)
  }
  if (lower.endsWith(".docx")) {
    return parseDocxBrowser(buffer, name)
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsxBrowser(buffer, name)
  }
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer)
    return { text, filename: name }
  }
  return null
}

async function parseDocxBrowser(buffer: ArrayBuffer, filename: string): Promise<ParsedDocLocal> {
  // mammoth/mammoth.browser экспортирует convertToMarkdown / convertToHtml для браузера.
  // Dynamic import чтобы не раздувать initial bundle (mammoth ~500KB).
  const mammoth = await import("mammoth/mammoth.browser.js" as string).catch(() => null as never)
  if (!mammoth) {
    return {
      text: `[Не удалось загрузить парсер DOCX. Откройте файл «${filename}» вручную и вставьте текст в чат.]`,
      filename,
      warning: "mammoth_load_failed",
    }
  }
  try {
    const result = await mammoth.convertToMarkdown({ arrayBuffer: buffer })
    return {
      text: result.value || "",
      filename,
      warning: result.messages?.length ? `${result.messages.length} предупреждений при парсинге` : undefined,
    }
  } catch (err) {
    return {
      text: `[Ошибка при парсинге DOCX: ${err instanceof Error ? err.message : String(err)}]`,
      filename,
      warning: "parse_error",
    }
  }
}

async function parseXlsxBrowser(buffer: ArrayBuffer, filename: string): Promise<ParsedDocLocal> {
  const XLSX = await import("xlsx").catch(() => null as never)
  if (!XLSX) {
    return {
      text: `[Не удалось загрузить парсер XLSX. Откройте файл «${filename}» вручную и вставьте текст в чат.]`,
      filename,
      warning: "xlsx_load_failed",
    }
  }
  try {
    const workbook = XLSX.read(buffer, { type: "array" })
    const parts: string[] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const md = XLSX.utils.sheet_to_csv(sheet, { FS: " | ", RS: "\n" })
      parts.push(`### Лист «${sheetName}»\n\n${md}`)
    }
    return {
      text: parts.join("\n\n---\n\n"),
      filename,
      pages: workbook.SheetNames.length,
    }
  } catch (err) {
    return {
      text: `[Ошибка при парсинге XLSX: ${err instanceof Error ? err.message : String(err)}]`,
      filename,
      warning: "parse_error",
    }
  }
}

async function parsePdfBrowser(buffer: ArrayBuffer, filename: string): Promise<ParsedDocLocal> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf")
    const bytes = new Uint8Array(buffer)
    const pdf = await getDocumentProxy(bytes)
    const { text, totalPages } = await extractText(pdf, { mergePages: false })

    const pages = Array.isArray(text) ? text : [text]
    const formatted = pages
      .map((page, i) => {
        const cleaned = page.replace(/\s+\n/g, "\n").trim()
        return cleaned ? `## Страница ${i + 1}\n\n${cleaned}` : `## Страница ${i + 1}\n\n(пусто)`
      })
      .join("\n\n")

    if (formatted.trim().length === 0) {
      return {
        text: `[PDF не содержит извлекаемого текста (возможно, скан-копия — нужен OCR)]`,
        filename,
        pages: totalPages,
        warning: "no_text_content",
      }
    }

    return { text: formatted, filename, pages: totalPages }
  } catch (err) {
    return {
      text: `[Ошибка при парсинге PDF: ${err instanceof Error ? err.message : String(err)}]`,
      filename,
      warning: "parse_error",
    }
  }
}
