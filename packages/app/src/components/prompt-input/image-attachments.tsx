import { Component, For, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import type { ImageAttachmentPart } from "@/context/prompt"

type PromptImageAttachmentsProps = {
  attachments: ImageAttachmentPart[]
  onOpen: (attachment: ImageAttachmentPart) => void
  onRemove: (id: string) => void
  removeLabel: string
}

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".")
  if (idx === -1) return ""
  return filename.slice(idx + 1).toUpperCase()
}

function isDocumentAttachment(attachment: ImageAttachmentPart): boolean {
  return attachment.mime === "ourapp/office" || attachment.mime === "application/pdf"
}

const imageClass =
  "size-16 rounded-md object-cover border border-border-base hover:border-border-strong-base transition-colors cursor-pointer"
const removeClass =
  "absolute -top-1.5 -right-1.5 size-5 rounded-full bg-surface-raised-stronger-non-alpha border border-border-base flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-raised-base-hover"

export const PromptImageAttachments: Component<PromptImageAttachmentsProps> = (props) => {
  return (
    <Show when={props.attachments.length > 0}>
      <div class="flex flex-wrap gap-2 px-3 pt-3">
        <For each={props.attachments}>
          {(attachment) => (
            <Show
              when={isDocumentAttachment(attachment)}
              fallback={
                <Tooltip value={attachment.filename} placement="top" contentClass="break-all">
                  <div class="relative group">
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.filename}
                      class={imageClass}
                      onClick={() => props.onOpen(attachment)}
                    />
                    <button
                      type="button"
                      onClick={() => props.onRemove(attachment.id)}
                      class={removeClass}
                      aria-label={props.removeLabel}
                    >
                      <Icon name="close" class="size-3 text-text-weak" />
                    </button>
                  </div>
                </Tooltip>
              }
            >
              <DocumentAttachmentCard
                attachment={attachment}
                onRemove={() => props.onRemove(attachment.id)}
                removeLabel={props.removeLabel}
              />
            </Show>
          )}
        </For>
      </div>
    </Show>
  )
}

function DocumentAttachmentCard(props: {
  attachment: ImageAttachmentPart
  onRemove: () => void
  removeLabel: string
}) {
  const ext = () => getFileExtension(props.attachment.filename)
  const name = () => {
    const full = props.attachment.filename
    if (full.length <= 28) return full
    const dotIdx = full.lastIndexOf(".")
    if (dotIdx === -1) return full.slice(0, 25) + "..."
    const base = full.slice(0, dotIdx)
    const extension = full.slice(dotIdx)
    return base.slice(0, 25 - extension.length) + "..." + extension
  }

  return (
    <Tooltip value={props.attachment.filename} placement="top" contentClass="break-all">
      <div class="relative group">
        <div class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-base bg-surface-base hover:border-border-strong-base transition-colors min-w-[140px] max-w-[220px]">
          <div class="shrink-0 size-8 rounded-md bg-surface-raised-base flex items-center justify-center">
            <Icon name="folder" class="size-4 text-text-weak" />
          </div>
          <div class="flex flex-col min-w-0 gap-0.5">
            <span class="text-12-regular text-text-base truncate leading-tight">{name()}</span>
            <span class="text-10-regular text-text-weak uppercase tracking-wider leading-tight">{ext()}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => props.onRemove()}
          class={removeClass}
          aria-label={props.removeLabel}
        >
          <Icon name="close" class="size-3 text-text-weak" />
        </button>
      </div>
    </Tooltip>
  )
}
