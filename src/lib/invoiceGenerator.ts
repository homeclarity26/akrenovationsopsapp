// Minimal invoice -> .docx generator. Uses the same `docx` lib as the
// proposal generator; keeps layout simple and branded. Returns a Blob +
// filename suitable for ShareMenu.

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
  HeadingLevel,
} from 'docx'

export interface InvoiceLineItem {
  label: string
  amount: number
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
}

const NAVY = '1F2B4F'
const RUST = '9B5A3E'

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function p(text: string, opts?: { bold?: boolean; size?: number; color?: string; align?: 'left' | 'center' | 'right' }): Paragraph {
  return new Paragraph({
    alignment:
      opts?.align === 'center' ? AlignmentType.CENTER :
      opts?.align === 'right' ? AlignmentType.RIGHT :
      AlignmentType.LEFT,
    children: [new TextRun({
      text,
      bold: opts?.bold,
      size: opts?.size ?? 22,
      color: opts?.color ?? '333333',
    })],
  })
}

function hrule(): Paragraph {
  return new Paragraph({
    border: { bottom: { color: RUST, space: 1, style: BorderStyle.SINGLE, size: 8 } },
    children: [new TextRun({ text: '' })],
  })
}

function cell(text: string | Paragraph, opts?: { width?: number; bold?: boolean; align?: 'left' | 'right' }): TableCell {
  const content = typeof text === 'string' ? p(text, { bold: opts?.bold, align: opts?.align }) : text
  return new TableCell({
    children: [content],
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
      left:   { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' },
      right:  { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' },
    },
  })
}

export async function buildInvoiceDocxBlob(data: InvoiceData): Promise<{ blob: Blob; filename: string }> {
  const subtotal = data.lineItems.reduce((sum, li) => sum + (li.amount || 0), 0)
  const tax = subtotal * (data.taxRate ?? 0)
  const total = subtotal + tax
  const balance = total - (data.amountPaid ?? 0)

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          children: [
            p('AK RENOVATIONS', { bold: true, size: 32, color: NAVY }),
            p('Ohio\'s Trusted Contractor', { size: 20, color: '666666' }),
          ],
          borders: emptyBorders(),
        }),
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          children: [
            p('INVOICE', { bold: true, size: 36, color: NAVY, align: 'right' }),
            p(`#${data.invoiceNumber}   ·   ${data.issueDate}`, { size: 20, color: '666666', align: 'right' }),
          ],
          borders: emptyBorders(),
        }),
      ],
    })],
  })

  const lineItemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: emptyBorders(),
    rows: [
      new TableRow({
        children: [
          cell(p('DESCRIPTION', { bold: true, size: 18, color: '666666' }), { width: 75 }),
          cell(p('AMOUNT', { bold: true, size: 18, color: '666666', align: 'right' }), { width: 25, align: 'right' }),
        ],
      }),
      ...data.lineItems.map((li) => new TableRow({
        children: [
          cell(li.label, { width: 75 }),
          cell(fmtUsd(li.amount), { width: 25, align: 'right' }),
        ],
      })),
    ],
  })

  const children = [
    headerTable,
    p(''),
    hrule(),
    p(''),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: data.title, bold: true, size: 28, color: NAVY })],
    }),
    p(''),
    p('Billed to:', { bold: true, size: 20, color: '666666' }),
    p(data.clientName, { size: 22 }),
    ...(data.clientAddress ? [p(data.clientAddress, { size: 22 })] : []),
    ...(data.dueDate ? [p(''), p(`Due: ${data.dueDate}`, { bold: true, size: 22 })] : []),
    p(''),
    lineItemsTable,
    p(''),
    p(`Subtotal: ${fmtUsd(subtotal)}`, { align: 'right', size: 22 }),
    ...(tax > 0 ? [p(`Tax: ${fmtUsd(tax)}`, { align: 'right', size: 22 })] : []),
    p(`Total: ${fmtUsd(total)}`, { align: 'right', bold: true, size: 24 }),
    ...(data.amountPaid && data.amountPaid > 0 ? [p(`Paid: ${fmtUsd(data.amountPaid)}`, { align: 'right', size: 22, color: '2E7D32' })] : []),
    ...(balance > 0 ? [p(`Balance Due: ${fmtUsd(balance)}`, { align: 'right', bold: true, size: 24, color: RUST })] : []),
    p(''),
    ...(data.notes ? [p(''), p('Notes:', { bold: true, size: 20, color: '666666' }), p(data.notes, { size: 20 })] : []),
  ]

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial' } },
      },
    },
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  const safeClient = data.clientName.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `${safeClient}_Invoice_${data.invoiceNumber}.docx`
  return { blob, filename }
}

function emptyBorders() {
  return {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }
}
