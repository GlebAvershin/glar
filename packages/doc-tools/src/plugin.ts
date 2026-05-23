/**
 * opencode plugin: document tools.
 *
 * Adds two agent-callable tools:
 *   - parse_document  → extract text from PDF/DOCX/XLSX
 *   - generate_docx   → render markdown to a Word .docx file on disk
 *
 * Register in `opencode.jsonc` under `plugin: ["@ourapp/doc-tools/plugin"]`
 * (or load programmatically via the desktop main process).
 */
import { tool, type Plugin } from "@opencode-ai/plugin"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { parseAny } from "./parsers/index.ts"
import { generateDocx } from "./generators/index.ts"
import { markdownToBlocks } from "./markdown-to-blocks.ts"

const z = tool.schema

export const DocToolsPlugin: Plugin = async (_ctx) => {
  return {
    tool: {
      parse_document: tool({
        description:
          "Извлечь текст из документа (PDF, DOCX, XLSX). " +
          "Возвращает plain-text/markdown — отдай результат модели для анализа. " +
          "Используй когда пользователь приложил договор, отчёт, таблицу.",
        args: {
          path: z
            .string()
            .min(1)
            .describe(
              "Путь к файлу. Относительный путь будет резолвиться от рабочей директории сессии.",
            ),
          format: z
            .enum(["pdf", "docx", "xlsx"])
            .optional()
            .describe("Формат документа. Если не указан — определяется по расширению."),
        },
        async execute(args, ctx) {
          const abs = path.isAbsolute(args.path) ? args.path : path.resolve(ctx.directory, args.path)
          const parsed = await parseAny({ path: abs, format: args.format })
          return {
            title: `Документ: ${path.basename(abs)}`,
            output: parsed.text,
            metadata: {
              path: abs,
              pages: parsed.metadata.pages,
              warnings: parsed.metadata.warnings ?? [],
            },
          }
        },
      }),

      generate_docx: tool({
        description:
          "Сгенерировать Word-документ (.docx) из Markdown-разметки и сохранить на диск. " +
          "Поддерживает заголовки (#/##/###), параграфы, таблицы. Используй для итогового " +
          "артефакта: договор, претензия, пояснительная записка.",
        args: {
          output_path: z
            .string()
            .min(1)
            .describe(
              "Куда сохранить файл. Относительный путь — от рабочей директории сессии. " +
                "Должен заканчиваться на .docx.",
            ),
          title: z
            .string()
            .optional()
            .describe("Заголовок документа (записывается в метаданные)."),
          markdown: z
            .string()
            .min(1)
            .describe(
              "Содержимое в Markdown. Можно использовать #/##/### для заголовков, " +
                "пустые строки как разрыв, и pipe-таблицы (| col | col |).",
            ),
        },
        async execute(args, ctx) {
          if (!args.output_path.toLowerCase().endsWith(".docx")) {
            throw new Error("output_path must end with .docx")
          }
          const abs = path.isAbsolute(args.output_path)
            ? args.output_path
            : path.resolve(ctx.directory, args.output_path)
          const blocks = markdownToBlocks(args.markdown)
          const bytes = await generateDocx({
            title: args.title,
            blocks,
          })
          await writeFile(abs, bytes)
          return {
            title: `Сгенерирован документ: ${path.basename(abs)}`,
            output: `Файл сохранён: ${abs} (${bytes.byteLength} байт, блоков: ${blocks.length})`,
            metadata: {
              savedTo: abs,
              bytes: bytes.byteLength,
              blocks: blocks.length,
            },
          }
        },
      }),
    },
  }
}

// Default export — opencode's plugin loader looks for `default` when given an
// npm-style spec like `"@ourapp/doc-tools/plugin"`.
export default DocToolsPlugin

// Pure-function exports for direct use (testing, non-opencode contexts).
export { parseAny, generateDocx, markdownToBlocks }
