/**
 * Source → Uint8Array helper. Reads from disk or accepts in-memory buffers.
 * Centralized so all parsers share the same input contract.
 */
import { readFile } from "node:fs/promises"
import type { DocSource } from "../types.ts"

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB — hard cap, sensible for legal/accounting docs.

export async function loadBytes(source: DocSource): Promise<Uint8Array> {
  if (source.path !== undefined) {
    const buf = await readFile(source.path)
    if (buf.byteLength > MAX_BYTES) {
      throw new Error(
        `Document too large: ${formatBytes(buf.byteLength)} (max ${formatBytes(MAX_BYTES)})`,
      )
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  if (source.buffer !== undefined) {
    const bytes =
      source.buffer instanceof Uint8Array
        ? source.buffer
        : new Uint8Array(source.buffer)
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error(
        `Document too large: ${formatBytes(bytes.byteLength)} (max ${formatBytes(MAX_BYTES)})`,
      )
    }
    return bytes
  }
  throw new Error("DocSource: either path or buffer must be provided")
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / (1024 * 1024)).toFixed(1)}MB`
}
