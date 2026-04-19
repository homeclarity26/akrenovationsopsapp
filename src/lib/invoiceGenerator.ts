// Invoice -> .docx generator. Shares header/footer/colors with the proposal
// generator via docxBrand so every document in the client-facing stack
// reads as one visual system — same navy/rust palette, same Arial
// typography, same tagline footer, same rust accent rule. Only the body
// content + table structure differ between docs.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
} from 'docx'
import {
  BRAND,
  PAGE_WIDTH_DXA,
  noBorders,
  softRowBorders,
  eyebrow,
  rustRule,
  sp,
  compactCoverBar,
  brandFooter,
  AK_PHONE,
  AK_WEBSITE,
} from './docxBrand'

export interface InvoiceLineItem {
  label: string
  amount: number
  /** 'base' (from the proposal milestone) or 'change_order'. Tints rendering. */
  kind?: 'base' | 'change_order' | string
}

export interface InvoiceData {
  invoiceNumber: string
  title: string
  clientName: string
  clientAddress?: string | null
  issueDate: string           // YYYY-MM-DD
  dueDate?: string | null     // YYYY-MM-DD
  lineItems: InvoiceLineItem[]
  taxRate?: number            // 0..1
  amountPaid?: number
  notes?: string | null
  /** Optional proposal title. When present, renders an "against proposal" line. */
  proposalTitle?: string | null
  /** Optional milestone label (e.g., "Rough-in"). */
  milestoneLabel?: string | null
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function p(text: string, opts?: {
  bold?: boolean
  size?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  italics?: boolean
}): Paragraph {
  return new Paragraph({
    alignment:
      opts?.align === 'center' ? AlignmentType.CENTER :
      opts?.align === 'right'  ? AlignmentType.RIGHT  :
      AlignmentType.LEFT,
    children: [new TextRun({
      text,
      bold: opts?.bold,
      italics: opts?.italics,
      size: opts?.size ?? 22,
      color: opts?.color ?? BRAND.TEXT,
      font: 'Arial',
    })],
  })
}

function cell(
  content: string | Paragraph,
  opts?: { width?: number; bold?: boolean; align?: 'left' | 'right'; shade?: string },
): TableCell {
  const para = typeof content === 'string' ? p(content, { bold: opts?.bold, align: opts?.align }) : content
  return new TableCell({
    children: [para],
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    borders: softRowBorders,
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
  })
}

export async function buildInvoiceDocxBlob(data: InvoiceData): Promise<{ blob: Blob; filename: string }> {
  const subtotal = data.lineItems.reduce((sum, li) => sum + (li.amount || 0), 0)
  const tax = subtotal * (data.taxRate ?? 0)
  const total = subtotal + tax
  const balance = total - (data.amountPaid ?? 0)

  // Line items table — header row in rust accent + rows in soft borders.
  const lineItemsTable = new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [Math.round(PAGE_WIDTH_DXA * 0.75), Math.round(PAGE_WIDTH_DXA * 0.25)],
    borders: noBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND.RUST } },
            shading: { fill: BRAND.RUST_TINT, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 160, right: 160 },
            width: { size: 75, type: WidthType.PERCENTAGE },
            children: [p('DESCRIPTION', { bold: true, size: 18, color: BRAND.TEXT_MUTED })],
          }),
          new TableCell({
            borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND.RUST } },
            shading: { fill: BRAND.RUST_TINT, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 160, right: 160 },
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [p('AMOUNT', { bold: true, size: 18, color: BRAND.TEXT_MUTED, align: 'right' })],
          }),
        ],
      }),
      ...data.lineItems.map((li) => {
        const isChange = li.kind === 'change_order'
        return new TableRow({
          children: [
            cell(
              p(li.label, { size: 22, color: isChange ? BRAND.RUST : BRAND.TEXT }),
              { width: 75 },
            ),
            cell(
              p(fmtUsd(li.amount), { size: 22, align: 'right', color: isChange ? BRAND.RUST : BRAND.TEXT }),
              { width: 25, align: 'right' },
            ),
          ],
        })
      }),
    ],
  })

  // "Billed to" block + issue/due dates — two columns, no visual borders.
  const metaTable = new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [PAGE_WIDTH_DXA / 2, PAGE_WIDTH_DXA / 2],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              p('BILLED TO', { bold: true, size: 16, color: BRAND.TEXT_MUTED }),
              p(data.clientName, { size: 22, bold: true }),
              ...(data.clientAddress ? [p(data.clientAddress, { size: 20, color: BRAND.TEXT_MUTED })] : []),
              ...(data.proposalTitle
                ? [p(`Against proposal: ${data.proposalTitle}`, { size: 18, color: BRAND.TEXT_MUTED, italics: true })]
                : []),
            ],
          }),
          new TableCell({
            borders: noBorders,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              p('ISSUE DATE', { bold: true, size: 16, color: BRAND.TEXT_MUTED, align: 'right' }),
              p(data.issueDate, { size: 22, align: 'right' }),
              ...(data.dueDate ? [
                p(''),
                p('DUE', { bold: true, size: 16, color: BRAND.TEXT_MUTED, align: 'right' }),
                p(data.dueDate, { size: 22, bold: true, align: 'right' }),
              ] : []),
            ],
          }),
        ],
      }),
    ],
  })

  // Totals block — right-aligned mini table so amounts stack neatly under the
  // line items instead of floating at random indentation.
  function totalsRow(label: string, value: string, opts?: { bold?: boolean; color?: string; size?: number }): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          margins: { top: 40, bottom: 40, left: 160, right: 160 },
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [p(label, { align: 'right', bold: opts?.bold, color: opts?.color ?? BRAND.TEXT_MUTED, size: opts?.size ?? 20 })],
        }),
        new TableCell({
          borders: noBorders,
          margins: { top: 40, bottom: 40, left: 160, right: 160 },
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [p(value, { align: 'right', bold: opts?.bold, color: opts?.color ?? BRAND.TEXT, size: opts?.size ?? 22 })],
        }),
      ],
    })
  }

  const totalsTable = new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [Math.round(PAGE_WIDTH_DXA * 0.7), Math.round(PAGE_WIDTH_DXA * 0.3)],
    borders: noBorders,
    rows: [
      totalsRow('Subtotal', fmtUsd(subtotal)),
      ...(tax > 0 ? [totalsRow('Tax', fmtUsd(tax))] : []),
      totalsRow('Total', fmtUsd(total), { bold: true, color: BRAND.NAVY, size: 26 }),
      ...(data.amountPaid && data.amountPaid > 0
        ? [totalsRow('Paid', fmtUsd(data.amountPaid), { color: '2E7D32' })]
        : []),
      ...(balance > 0
        ? [totalsRow('Balance Due', fmtUsd(balance), { bold: true, color: BRAND.RUST, size: 28 })]
        : []),
    ],
  })

  const children = [
    compactCoverBar(
      'INVOICE',
      `#${data.invoiceNumber}  ·  ${data.issueDate}`,
      { titleBelow: data.milestoneLabel ? `Milestone: ${data.milestoneLabel}` : '' },
    ),
    sp(320),

    // Invoice title below the bar, navy headline, same typographic weight
    // as the proposal's section titles.
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: data.title, font: 'Arial', size: 36, bold: true, color: BRAND.NAVY })],
    }),
    rustRule(),
    sp(240),

    metaTable,
    sp(320),

    eyebrow('Line items'),
    lineItemsTable,
    sp(240),

    totalsTable,
    sp(240),

    ...(data.notes
      ? [
          eyebrow('Notes'),
          p(data.notes, { size: 20, color: BRAND.TEXT_MUTED }),
          sp(240),
        ]
      : []),

    rustRule(),
    sp(120),
    p(
      `Please remit by ${data.dueDate ?? 'the agreed due date'}. Checks payable to AK Renovations, LLC. Online payment link sent separately if enabled.`,
      { size: 18, color: BRAND.TEXT_MUTED, italics: true },
    ),
    sp(320),

    brandFooter(AK_PHONE, AK_WEBSITE),
  ]

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial' } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const safeClient = (data.clientName || 'Client').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Client'
  const filename = `${safeClient}_Invoice_${data.invoiceNumber}.docx`
  return { blob, filename }
}
