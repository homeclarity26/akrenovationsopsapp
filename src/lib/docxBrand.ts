// Shared docx brand tokens + helpers. Anything that appears on the proposal
// AND the invoice (and any future client-facing doc like a change-order or
// warranty letter) lives here so we have one source of truth for colors,
// typography, and chrome layout.
//
// The proposal generator has used these values since the locked-Node port.
// The invoice generator was drifting with slightly-wrong hex codes; this
// module pulls everything back in line so the two documents read as one
// visual system.

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  ShadingType,
  AlignmentType,
} from 'docx'

// ── Colors ──────────────────────────────────────────────────────────
export const BRAND = {
  NAVY: '1B2B4D',
  RUST: 'B7410E',
  WHITE: 'FFFFFF',
  RUST_TINT: 'FAF1EE',
  /** Footer left-side wordmark — muted blue on navy */
  FOOTER_WORDMARK: 'CCDDEE',
  /** Footer tagline — muted blue on navy */
  FOOTER_TAGLINE: 'AABBCC',
  /** Cover-block eyebrow — muted blue on navy */
  COVER_EYEBROW: '7A9BBC',
  TEXT: '333333',
  TEXT_MUTED: '666666',
  BORDER: 'DDDDDD',
}

export const AK_PHONE = '(330) 942-4242'
export const AK_WEBSITE = 'akrenovationsohio.com'

/** Standard page width in DXA (twentieths of a point) — letter - 0.5" margins. */
export const PAGE_WIDTH_DXA = 9360

// ── Cell border presets ─────────────────────────────────────────────
export const noBorders = {
  top:              { style: BorderStyle.NONE, size: 0, color: BRAND.WHITE },
  bottom:           { style: BorderStyle.NONE, size: 0, color: BRAND.WHITE },
  left:             { style: BorderStyle.NONE, size: 0, color: BRAND.WHITE },
  right:            { style: BorderStyle.NONE, size: 0, color: BRAND.WHITE },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: BRAND.WHITE },
  insideVertical:   { style: BorderStyle.NONE, size: 0, color: BRAND.WHITE },
}

export const softRowBorders = {
  top:    { style: BorderStyle.SINGLE, size: 4, color: BRAND.BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND.BORDER },
  left:   { style: BorderStyle.NONE,   size: 0, color: BRAND.WHITE },
  right:  { style: BorderStyle.NONE,   size: 0, color: BRAND.WHITE },
}

// ── Primitive runs ──────────────────────────────────────────────────
/** Small uppercase section label. Matches the proposal's eyebrow styling. */
export function eyebrow(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: 'Arial',
        size: 18,
        bold: true,
        color: BRAND.TEXT_MUTED,
        characterSpacing: 40,
      }),
    ],
  })
}

/** The thin rust rule used between sections. */
export function rustRule(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND.RUST, space: 1 },
    },
    children: [new TextRun({ text: '' })],
  })
}

/** Blank paragraph for vertical spacing. */
export function sp(afterDxa = 0): Paragraph {
  return new Paragraph({ spacing: { before: 0, after: afterDxa }, children: [] })
}

// ── Condensed cover bar (invoice / change-order etc.) ────────────────
// A tight navy band at the top with the AK wordmark on the left and a
// document-type + number on the right. This is the lightweight counterpart
// to the proposal's full-page cover — same colors, same font, same
// character-spacing pattern, just compressed to one row.
export function compactCoverBar(
  docLabel: string,
  rightSubline: string,
  opts?: { titleBelow?: string },
): Table {
  return new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH_DXA / 2, PAGE_WIDTH_DXA / 2],
    borders: noBorders,
    rows: [
      // Top rust rule (same rhythm as the proposal's accent band).
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: BRAND.RUST, type: ShadingType.CLEAR },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({ spacing: { before: 30, after: 30 }, children: [] })],
            columnSpan: 2,
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE_WIDTH_DXA / 2, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: BRAND.NAVY, type: ShadingType.CLEAR },
            margins: { top: 360, bottom: 360, left: 400, right: 200 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'AK RENOVATIONS',
                    font: 'Arial',
                    size: 22,
                    color: BRAND.COVER_EYEBROW,
                    characterSpacing: 60,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 40, after: 0 },
                children: [
                  new TextRun({
                    text: opts?.titleBelow ?? '',
                    font: 'Arial',
                    size: 20,
                    bold: true,
                    color: BRAND.WHITE,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: PAGE_WIDTH_DXA / 2, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: BRAND.NAVY, type: ShadingType.CLEAR },
            margins: { top: 360, bottom: 360, left: 200, right: 400 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: docLabel.toUpperCase(),
                    font: 'Arial',
                    size: 34,
                    bold: true,
                    color: BRAND.WHITE,
                    characterSpacing: 40,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 40, after: 0 },
                children: [
                  new TextRun({
                    text: rightSubline,
                    font: 'Arial',
                    size: 20,
                    color: BRAND.COVER_EYEBROW,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

// ── Shared footer ────────────────────────────────────────────────────
// Identical on every brand doc — the proposal already uses this shape so
// the invoice can now call the same helper.
export function brandFooter(
  phone: string = AK_PHONE,
  website: string = AK_WEBSITE,
): Table {
  return new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH_DXA / 2, PAGE_WIDTH_DXA / 2],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE_WIDTH_DXA / 2, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: BRAND.NAVY, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 280, right: 200 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'AK RENOVATIONS',
                    font: 'Arial',
                    size: 17,
                    color: BRAND.FOOTER_WORDMARK,
                    characterSpacing: 50,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: PAGE_WIDTH_DXA / 2, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: BRAND.NAVY, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 200, right: 280 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Craftsmanship you can trust. Communication you deserve.  |  ${phone}  |  ${website}`,
                    font: 'Arial',
                    size: 16,
                    color: BRAND.FOOTER_TAGLINE,
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}
