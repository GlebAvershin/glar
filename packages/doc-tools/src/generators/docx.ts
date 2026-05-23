/**
 * DOCX generator via the `docx` library (pure JS, no native deps).
 * Accepts a structured spec, returns Uint8Array ready to be written or sent.
 */
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"
import type { DocxBlock, DocxSpec } from "../types.ts"

export async function generateDocx(spec: DocxSpec): Promise<Uint8Array> {
  const children = spec.blocks.flatMap(blockToElements)

  const doc = new Document({
    creator: spec.author ?? "OurApp",
    title: spec.title,
    sections: [
      {
        properties: {},
        children: children.length > 0 ? children : [new Paragraph({ text: "" })],
      },
    ],
  })

  const buf = await Packer.toBuffer(doc)
  return new Uint8Array(buf)
}

function blockToElements(block: DocxBlock): (Paragraph | Table)[] {
  switch (block.kind) {
    case "heading": {
      const level = ({ 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const)[
        block.level
      ]
      return [new Paragraph({ text: block.text, heading: level })]
    }
    case "paragraph": {
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: block.text,
              bold: block.bold ?? false,
              italics: block.italic ?? false,
            }),
          ],
        }),
      ]
    }
    case "table": {
      if (block.rows.length === 0) return []
      const colCount = Math.max(...block.rows.map((r) => r.length))
      const tableRows = block.rows.map(
        (row) =>
          new TableRow({
            children: Array.from({ length: colCount }, (_, ci) => {
              const cell = row[ci] ?? ""
              return new TableCell({
                children: [new Paragraph({ text: String(cell) })],
              })
            }),
          }),
      )
      return [
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      ]
    }
    case "spacer":
      return [new Paragraph({ text: "" })]
  }
}
