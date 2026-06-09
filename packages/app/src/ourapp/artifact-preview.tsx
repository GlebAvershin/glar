/**
 * OurApp — Artifact Preview Panel context & component.
 *
 * Manages the right-side panel that shows generated documents (DOCX/PDF)
 * with a rendered preview and download button. Triggered when the agent
 * calls `generate_docx` or when user clicks an artifact card in chat.
 */
import { createSignal, Show, type Component } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"

export interface ArtifactInfo {
  /** Display name (e.g. "Претензия.docx") */
  filename: string
  /** Absolute path on disk (or virtual name for browser-generated docs) */
  path: string
  /** File size in bytes */
  bytes?: number
  /** Rendered HTML content (for DOCX preview via mammoth) */
  html?: string
  /** Plain text fallback (when HTML not available) */
  text?: string
  /** Number of blocks/pages */
  blocks?: number
  /** Blob URL for browser-generated DOCX (for download button in preview) */
  blobUrl?: string
}

const [artifactPanel, setArtifactPanel] = createSignal<ArtifactInfo | null>(null)

export function openArtifactPreview(info: ArtifactInfo) {
  setArtifactPanel(info)
}

export function closeArtifactPreview() {
  setArtifactPanel(null)
}

export function useArtifactPanel() {
  return {
    artifact: artifactPanel,
    open: openArtifactPreview,
    close: closeArtifactPreview,
    isOpen: () => artifactPanel() !== null,
  }
}

export const ArtifactPreviewPanel: Component<{ class?: string }> = (props) => {
  const artifact = artifactPanel

  return (
    <Show when={artifact()}>
      {(info) => (
        <aside
          class="flex flex-col h-full border-l border-border-weaker-base bg-background-base w-[420px] shrink-0 animate-in slide-in-from-right-2 duration-200"
        >
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 border-b border-border-weaker-base shrink-0">
            <div class="flex items-center gap-2 min-w-0">
              <Icon name="folder" class="size-4 text-text-weak shrink-0" />
              <span class="text-13-regular text-text-base truncate">{info().filename}</span>
              <span class="text-11-regular text-text-weak uppercase tracking-wider shrink-0">
                {getExtension(info().filename)}
              </span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <IconButton
                icon="download"
                variant="ghost"
                aria-label="Скачать файл"
                onClick={() => downloadArtifact(info())}
              />
              <IconButton
                icon="close"
                variant="ghost"
                aria-label="Закрыть"
                onClick={closeArtifactPreview}
              />
            </div>
          </div>

          {/* Content */}
          <div class="flex-1 overflow-auto p-6">
            <Show
              when={info().html}
              fallback={
                <pre class="text-13-regular text-text-base whitespace-pre-wrap font-sans leading-relaxed">
                  {info().text ?? "Предпросмотр недоступен"}
                </pre>
              }
            >
              <div
                class="artifact-preview-content prose prose-sm max-w-none"
                innerHTML={info().html}
              />
            </Show>
          </div>

          {/* Footer */}
          <Show when={info().bytes}>
            <div class="px-4 py-2 border-t border-border-weaker-base shrink-0">
              <span class="text-11-regular text-text-weak">
                {formatBytes(info().bytes!)}
                {info().blocks ? ` · ${info().blocks} блоков` : ""}
              </span>
            </div>
          </Show>
        </aside>
      )}
    </Show>
  )
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

function downloadArtifact(info: ArtifactInfo) {
  if (info.blobUrl) {
    const a = document.createElement("a")
    a.href = info.blobUrl
    a.download = info.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return
  }
  // If it's a real path on disk, try Electron IPC
  if (typeof window !== "undefined" && "api" in window) {
    const api = (window as any).api
    if (api?.openPath) {
      api.openPath(info.path)
      return
    }
  }
}
