/**
 * Shared input/output types for document tools.
 *
 * Inputs accept either a filesystem path or an in-memory buffer.
 * Outputs are designed to be LLM-friendly (plain text first, structured second).
 */

/** Universal source for binary documents. */
export type DocSource =
  | { readonly path: string; readonly buffer?: undefined }
  | { readonly buffer: ArrayBuffer | Uint8Array; readonly path?: undefined }

/** Result of parsing a single-flow document (PDF, DOCX). */
export interface ParsedDoc {
  /** Plain text suitable for sending to an LLM. */
  readonly text: string
  /** Structural metadata. */
  readonly metadata: {
    /** Page count for PDF; section count for DOCX. */
    readonly pages?: number
    /** Non-fatal extraction warnings. */
    readonly warnings?: readonly string[]
  }
}

/** Single XLSX row — array of cell values aligned with header positions. */
export type XlsxRow = ReadonlyArray<string | number | boolean | null>

/** Parsed XLSX sheet — name + 2-d array of rows. */
export interface ParsedXlsxSheet {
  readonly name: string
  readonly rows: ReadonlyArray<XlsxRow>
}

/** Result of parsing an XLSX/CSV workbook. */
export interface ParsedXlsx {
  readonly sheets: ReadonlyArray<ParsedXlsxSheet>
  readonly metadata: {
    readonly sheetCount: number
    readonly totalRows: number
  }
}

// ---------- DOCX generation ----------

/** Block types for DOCX output. Keep simple — paragraphs, headings, tables. */
export type DocxBlock =
  | { readonly kind: "heading"; readonly level: 1 | 2 | 3; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string; readonly bold?: boolean; readonly italic?: boolean }
  | { readonly kind: "table"; readonly rows: ReadonlyArray<ReadonlyArray<string>> }
  | { readonly kind: "spacer" }

/** Full spec for a generated DOCX. */
export interface DocxSpec {
  readonly title?: string
  readonly author?: string
  readonly blocks: ReadonlyArray<DocxBlock>
}
