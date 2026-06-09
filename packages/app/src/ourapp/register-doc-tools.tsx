/**
 * OurApp — Register custom tool renderers for document tools.
 *
 * Registers `parse_document` and `generate_docx` with the ToolRegistry
 * so they render nicely in chat messages instead of the generic MCP fallback.
 *
 * Import this file early in the app lifecycle (e.g. from app.tsx).
 */
import { ToolRegistry } from "@opencode-ai/ui/message-part"
import { ArtifactCard } from "./artifact-card"

// generate_docx — shows an artifact card that opens the preview panel
ToolRegistry.register({
  name: "generate_docx",
  render(props) {
    // Only show the card when the tool has completed successfully
    if (props.status !== "completed") return null

    const filename = props.input?.title
      ? `${props.input.title}.docx`
      : (props.metadata?.savedTo?.split(/[/\\]/).pop() ?? "document.docx")

    // plugin.ts:48 schema объявляет `outputPath` (camelCase). Поддерживаем оба
    // варианта на случай если LLM нормализует к snake_case.
    const filePath =
      props.metadata?.savedTo ?? props.input?.outputPath ?? props.input?.output_path ?? ""

    return (
      <ArtifactCard
        filename={filename}
        path={filePath}
        bytes={props.metadata?.bytes}
        blocks={props.metadata?.blocks}
        text={props.output}
      />
    )
  },
})

// parse_document — shows a compact info card about the parsed document
ToolRegistry.register({
  name: "parse_document",
  render(props) {
    if (props.status !== "completed") return null

    const filename = () => {
      const p = props.input?.path ?? props.metadata?.path ?? ""
      return p.split(/[/\\]/).pop() || "документ"
    }

    return (
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-base bg-surface-base text-12-regular text-text-secondary max-w-[320px]">
        <span class="text-text-weak">📄</span>
        <span class="truncate">{filename()}</span>
        {props.metadata?.pages && <span class="text-text-weak shrink-0">· {props.metadata.pages} стр.</span>}
        <span class="text-text-weak shrink-0">✓ прочитан</span>
      </div>
    )
  },
})
