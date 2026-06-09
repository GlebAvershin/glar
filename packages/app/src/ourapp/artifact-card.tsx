/**
 * OurApp — Artifact Card component.
 *
 * Rendered inline in chat messages when the agent produces a document artifact
 * (via generate_docx tool). Clicking the card opens the right-side preview panel.
 */
import { type Component } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { openArtifactPreview, type ArtifactInfo } from "./artifact-preview"

export interface ArtifactCardProps {
  filename: string
  path: string
  bytes?: number
  blocks?: number
  /** Pre-rendered HTML for preview (from mammoth convertToHtml) */
  html?: string
  /** Plain text fallback */
  text?: string
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".")
  return idx === -1 ? "" : filename.slice(idx + 1).toUpperCase()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export const ArtifactCard: Component<ArtifactCardProps> = (props) => {
  const ext = () => getExtension(props.filename)

  const handleClick = async () => {
    let html = props.html
    let text = props.text

    // Если есть путь к .docx и нет готового HTML — попытаемся прочитать файл и
    // сконвертировать через mammoth. Electron preload (preload/index.ts) сейчас
    // НЕ экспортирует readFile — только openPath. Так что этот блок отработает
    // только когда добавим bridge. Пока оставляем text-fallback (см. else ниже).
    const api = typeof window !== "undefined" ? (window as { api?: { readFile?: (p: string) => Promise<ArrayBuffer> } }).api : undefined
    if (!html && props.path && props.path.toLowerCase().endsWith(".docx") && api?.readFile) {
      try {
        const mammoth = await import("mammoth/mammoth.browser.js" as string)
        const buffer = await api.readFile(props.path)
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
        html = result.value
      } catch (err) {
        console.warn("[artifact-card] DOCX-to-HTML conversion failed, using text fallback", err)
      }
    }

    const info: ArtifactInfo = {
      filename: props.filename,
      path: props.path,
      bytes: props.bytes,
      html,
      text,
      blocks: props.blocks,
    }
    openArtifactPreview(info)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      class="flex items-center gap-3 px-4 py-3 rounded-lg border border-border-base bg-surface-base hover:border-border-strong-base hover:bg-surface-raised-base transition-colors cursor-pointer text-left w-full max-w-[320px] group"
    >
      <div class="shrink-0 size-10 rounded-md bg-surface-raised-base flex items-center justify-center group-hover:bg-surface-raised-base-hover transition-colors">
        <Icon name="folder" class="size-5 text-text-weak" />
      </div>
      <div class="flex flex-col min-w-0 gap-0.5 flex-1">
        <span class="text-13-regular text-text-base truncate leading-tight">{props.filename}</span>
        <div class="flex items-center gap-2">
          <span class="text-11-regular text-text-weak uppercase tracking-wider">{ext()}</span>
          {props.bytes && (
            <span class="text-11-regular text-text-weak">{formatBytes(props.bytes)}</span>
          )}
        </div>
      </div>
      <Icon name="chevron-right" class="size-4 text-text-weak shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}
