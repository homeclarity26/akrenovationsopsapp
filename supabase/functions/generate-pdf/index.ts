// generate-pdf — Phase C
// Generates branded HTML/PDF documents for proposals, invoices, contracts, etc.
// Returns PDF buffer after rendering HTML template server-side.
// Saves to Supabase Storage and optionally syncs to Google Drive.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'

const InputSchema = z.object({
  document_type: z.enum(['proposal', 'invoice', 'contract', 'change_order', 'daily_log', 'punch_list', 'pl_report', 'bonus_summary', 'quote_comparison']),
  document_id: z.string(),
  options: z.object({
    include_signature_block: z.boolean().optional(),
    watermark: z.string().optional(),
  }).optional(),
})

interface GeneratePdfInput {
  document_type: 'proposal' | 'invoice' | 'contract' | 'change_order' | 'daily_log' | 'punch_list' | 'pl_report' | 'bonus_summary' | 'quote_comparison'
  document_id: string
  options?: {
    include_signature_block?: boolean
    watermark?: string  // 'DRAFT', 'PAID', etc.
  }
}

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// ── HTML Templates ────────────────────────────────────────────────────────────

function brandedHeader(docTitle: string, docNumber: string, date: string): string {
  return `
    <div class="header">
      <div class="header-left">
        <div class="wordmark">AK Renovations</div>
        <div class="tagline">Summit County's Trusted Renovation Contractor</div>
      </div>
      <div class="header-right">
        <div class="doc-title">${docTitle}</div>
        <div class="doc-meta">${docNumber} &nbsp;·&nbsp; ${date}</div>
      </div>
    </div>
    <div class="header-rule"></div>
  `
}

function brandedFooter(docNumber: string): string {
  return `
    <div class="footer-rule"></div>
    <div class="footer">
      <span>akrenovationsohio.com &nbsp;·&nbsp; (330) 555-0100</span>
      <span class="page-num">Page 1 of 1</span>
      <span>${docNumber}</span>
    </div>
  `
}

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; font-size: 10pt; color: #1A1A1A; background: white; padding: 40px 48px; line-height: 1.5; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .wordmark { font-family: 'Newsreader', Georgia, serif; font-size: 18pt; color: #1B2B4D; font-weight: 500; }
  .tagline { font-size: 9pt; color: #B7410E; margin-top: 2px; }
  .header-right { text-align: right; }
  .doc-title { font-size: 14pt; font-weight: 600; color: #1B2B4D; }
  .doc-meta { font-size: 10pt; color: #6B7280; margin-top: 2px; }
  .header-rule { height: 1px; background: #B7410E; margin-bottom: 24px; }

  .footer { display: flex; justify-content: space-between; font-size: 8pt; color: #9CA3AF; padding-top: 8px; }
  .footer-rule { height: 0.5px; background: #1B2B4D; margin-top: 32px; margin-bottom: 8px; }

  h2 { font-family: 'DM Sans', sans-serif; font-size: 11pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #1B2B4D; margin: 20px 0 8px 0; }
  p { margin-bottom: 8px; }

  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #E8DCC4; color: #1B2B4D; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 10px; text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #F0F0EE; font-size: 10pt; }
  tr:nth-child(even) td { background: #FAFAF8; }

  .total-row td { font-family: 'JetBrains Mono', monospace; font-weight: 600; background: #1B2B4D !important; color: white; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  .right { text-align: right; }

  .cover-block { margin-bottom: 24px; }
  .cover-block h1 { font-family: 'Newsreader', Georgia, serif; font-size: 22pt; color: #1B2B4D; margin-bottom: 4px; }
  .cover-block .subtitle { font-size: 11pt; color: #6B7280; }

  .signature-block { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E8E8E6; }
  .sig-line { display: flex; gap: 48px; margin-bottom: 24px; }
  .sig-field { flex: 1; }
  .sig-field .label { font-size: 9pt; color: #9CA3AF; margin-bottom: 24px; }
  .sig-field .line { border-bottom: 1px solid #1A1A1A; margin-bottom: 4px; }
  .sig-field .name { font-size: 9pt; color: #6B7280; }

  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 72pt; font-weight: 700; opacity: 0.08; color: #1B2B4D; z-index: -1; pointer-events: none; }

  .paid-stamp { display: inline-block; border: 3px solid #059669; color: #059669; font-size: 28pt; font-weight: 700; padding: 4px 16px; transform: rotate(-8deg); border-radius: 4px; opacity: 0.7; margin: 16px 0; }

  .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .bill-box h3 { font-size: 9pt; text-transform: uppercase; color: #9CA3AF; letter-spacing: 0.06em; margin-bottom: 8px; }
  .bill-box p { font-size: 10pt; line-height: 1.6; }

  @media print { body { padding: 0; } }
`

// ── Fetch document data ───────────────────────────────────────────────────────

async function fetchDocumentData(supabase: ReturnType<typeof createClient>, type: string, id: string) {
  switch (type) {
    case 'invoice': {
      const { data } = await supabase.from('invoices').select('*, projects(title, client_name, client_email, address)').eq('id', id).single()
      return data
    }
    case 'proposal': {
      const { data } = await supabase.from('proposals').select('*').eq('id', id).single()
      return data
    }
    case 'contract': {
      const { data } = await supabase.from('contracts').select('*, projects(title, client_name, client_email, address)').eq('id', id).single()
      return data
    }
    case 'change_order': {
      const { data } = await supabase.from('change_orders').select('*, projects(title, client_name, address)').eq('id', id).single()
      return data
    }
    case 'daily_log': {
      const { data } = await supabase.from('daily_logs').select('*, projects(title, client_name)').eq('id', id).single()
      return data
    }
    default:
      return null
  }
}

// ── HTML template builders ────────────────────────────────────────────────────

function buildInvoiceHtml(doc: Record<string, unknown>, options: GeneratePdfInput['options']): string {
  const proj = doc.projects as Record<string, unknown> | null
  const lineItems = (doc.line_items as { label?: string; description?: string; amount: number }[]) ?? []
  const invoiceDate = doc.created_at ? new Date(doc.created_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const dueDate = doc.due_date ? new Date(doc.due_date as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head>
<body>
  ${options?.watermark === 'PAID' ? '<div class="watermark">PAID</div>' : options?.watermark ? `<div class="watermark">${options.watermark}</div>` : ''}
  ${brandedHeader('INVOICE', doc.invoice_number as string ?? '', invoiceDate)}

  <div class="bill-grid">
    <div class="bill-box">
      <h3>Bill To</h3>
      <p><strong>${proj?.client_name ?? ''}</strong><br>${proj?.address ?? ''}</p>
    </div>
    <div class="bill-box">
      <h3>From</h3>
      <p><strong>AK Renovations</strong><br>Summit County, Ohio<br>(330) 555-0100<br>adam@akrenovationsohio.com</p>
    </div>
  </div>

  <div class="bill-grid" style="margin-bottom:16px;">
    <div class="bill-box">
      <h3>Project</h3>
      <p>${proj?.title ?? ''}</p>
    </div>
    <div class="bill-box">
      <h3>Due Date</h3>
      <p class="mono">${dueDate}</p>
    </div>
  </div>

  ${options?.watermark === 'PAID' ? '<div class="paid-stamp">PAID</div>' : ''}

  <h2>Line Items</h2>
  <table>
    <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${lineItems.map(li => `<tr><td>${li.label ?? li.description ?? ''}</td><td class="right mono">$${Number(li.amount).toLocaleString()}</td></tr>`).join('')}
    </tbody>
    <tfoot>
      <tr class="total-row"><td><strong>Total Due</strong></td><td class="right mono">$${Number(doc.total).toLocaleString()}</td></tr>
    </tfoot>
  </table>

  <h2>Payment Instructions</h2>
  <p>Pay online via the secure payment link included in your email, or by check made payable to <strong>AK Renovations</strong>.</p>
  <p>Questions? Call or text us at (330) 555-0100 or email adam@akrenovationsohio.com.</p>

  <p style="margin-top:24px; font-style:italic; color:#6B7280;">Thank you for choosing AK Renovations.</p>

  ${brandedFooter(doc.invoice_number as string ?? '')}
</body>
</html>`
}

function buildProposalHtml(doc: Record<string, unknown>, options: GeneratePdfInput['options']): string {
  const sections = (doc.sections as { title: string; bullets: string[] }[]) ?? []
  const date = doc.created_at ? new Date(doc.created_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const proposalNum = `PROP-${(doc.id as string ?? '').slice(0, 8).toUpperCase()}`

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head>
<body>
  ${options?.watermark ? `<div class="watermark">${options.watermark}</div>` : ''}
  ${brandedHeader('PROPOSAL', proposalNum, date)}

  <div class="cover-block">
    <h1>${doc.title as string ?? 'Project Proposal'}</h1>
    <div class="subtitle">Prepared for ${doc.client_name as string ?? ''} &nbsp;·&nbsp; ${doc.client_address as string ?? ''}</div>
  </div>

  ${doc.overview_body ? `<h2>Project Overview</h2><p>${(doc.overview_body as string).replace(/\n/g, '<br>')}</p>` : ''}

  <h2>Scope of Work</h2>
  ${sections.map(s => `
    <h3 style="font-size:10pt; font-weight:600; color:#1B2B4D; margin:12px 0 4px 0;">${s.title}</h3>
    <ul style="margin-left:16px; margin-bottom:8px;">
      ${(s.bullets ?? []).map((b: string) => `<li style="margin-bottom:3px;">${b}</li>`).join('')}
    </ul>
  `).join('')}

  <h2>Investment</h2>
  <table>
    <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
    <tbody>
      <tr><td>Total Project Investment</td><td class="right mono">$${Number(doc.total_price ?? 0).toLocaleString()}</td></tr>
    </tbody>
  </table>

  ${doc.duration ? `<h2>Timeline</h2><p>Estimated project duration: <strong>${doc.duration}</strong></p>` : ''}

  <h2>About AK Renovations</h2>
  <p>AK Renovations is Summit County's trusted high-end remodeling contractor. Licensed, insured, and backed by a 12-month workmanship warranty on all work performed.</p>

  <div class="signature-block">
    <p style="margin-bottom:16px;">By signing below, you agree to the scope and pricing above. A full contract will follow.</p>
    <div class="sig-line">
      <div class="sig-field">
        <div class="line"></div>
        <div class="name">Client Signature &nbsp;·&nbsp; Date</div>
      </div>
      <div class="sig-field">
        <div class="line"></div>
        <div class="name">Print Name</div>
      </div>
    </div>
  </div>

  ${brandedFooter(proposalNum)}
</body>
</html>`
}

function buildContractHtml(doc: Record<string, unknown>, options: GeneratePdfInput['options']): string {
  const proj = doc.projects as Record<string, unknown> | null
  const date = doc.created_at ? new Date(doc.created_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const contractNum = `CTR-${(doc.id as string ?? '').slice(0, 8).toUpperCase()}`
  const isSigned = (doc.status as string) === 'signed'

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head>
<body>
  ${brandedHeader('CONTRACT', contractNum, date)}

  <div class="cover-block">
    <h1>${doc.title as string ?? 'Construction Contract'}</h1>
  </div>

  <div class="bill-grid">
    <div class="bill-box">
      <h3>Client</h3>
      <p>${proj?.client_name ?? ''}<br>${proj?.address ?? ''}<br>${proj?.client_email ?? ''}</p>
    </div>
    <div class="bill-box">
      <h3>Contractor</h3>
      <p><strong>AK Renovations</strong><br>Adam Kilgore, Owner<br>Summit County, Ohio<br>License: OH-RC-2019-4847</p>
    </div>
  </div>

  <h2>Project Description</h2>
  <p>${proj?.title ?? ''}</p>

  <h2>Contract Price &amp; Payment Schedule</h2>
  <table>
    <thead><tr><th>Milestone</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${((doc.payment_schedule as { label: string; amount: number }[]) ?? []).map(p =>
        `<tr><td>${p.label}</td><td class="right mono">$${Number(p.amount).toLocaleString()}</td></tr>`
      ).join('')}
    </tbody>
    <tfoot>
      <tr class="total-row"><td><strong>Total Contract Value</strong></td><td class="right mono">$${Number(doc.total_value ?? 0).toLocaleString()}</td></tr>
    </tfoot>
  </table>

  <h2>Warranty</h2>
  <p>AK Renovations warrants all workmanship for 12 months from the date of substantial completion. This warranty covers defects in workmanship only and does not cover normal wear and tear, client-caused damage, or manufacturer defects in materials.</p>

  <h2>Change Orders</h2>
  <p>Any changes to the scope of work must be agreed upon in writing via a signed change order before work begins. Change orders may affect the contract price and timeline.</p>

  ${isSigned && doc.client_signed_at ? `
  <div class="signature-block">
    <h2>Signatures</h2>
    <p style="color:#059669; font-weight:600;">Digitally signed on ${new Date(doc.client_signed_at as string).toLocaleDateString()}</p>
    ${doc.client_signature_data ? `<img src="${doc.client_signature_data}" style="max-height:60px; margin:8px 0;" alt="Client signature">` : ''}
    <p style="font-size:8pt; color:#9CA3AF;">Signed from IP: ${doc.client_signed_ip ?? 'N/A'}</p>
  </div>` : options?.include_signature_block ? `
  <div class="signature-block">
    <div class="sig-line">
      <div class="sig-field">
        <div class="label">Client Signature</div>
        <div class="line"></div>
        <div class="name">Date: ____________</div>
      </div>
      <div class="sig-field">
        <div class="label">Print Name</div>
        <div class="line"></div>
      </div>
    </div>
    <div class="sig-line">
      <div class="sig-field">
        <div class="label">AK Renovations</div>
        <div class="line"></div>
        <div class="name">Adam Kilgore, Owner &nbsp;·&nbsp; Date: ____________</div>
      </div>
    </div>
  </div>` : ''}

  ${brandedFooter(contractNum)}
</body>
</html>`
}

function buildChangeOrderHtml(doc: Record<string, unknown>, options: GeneratePdfInput['options']): string {
  const proj = doc.projects as Record<string, unknown> | null
  const date = doc.created_at ? new Date(doc.created_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const coNum = `CO-${(doc.id as string ?? '').slice(0, 8).toUpperCase()}`

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head>
<body>
  ${brandedHeader('CHANGE ORDER', coNum, date)}

  <div class="cover-block">
    <h1>${doc.title as string ?? 'Change Order'}</h1>
    <div class="subtitle">Project: ${proj?.title ?? ''} &nbsp;·&nbsp; Client: ${proj?.client_name ?? ''}</div>
  </div>

  <h2>Description of Change</h2>
  <p>${doc.description as string ?? ''}</p>

  ${doc.scope_change ? `<h2>Scope Change</h2><p>${doc.scope_change as string}</p>` : ''}

  <h2>Financial Impact</h2>
  <table>
    <thead><tr><th>Item</th><th class="right">Amount</th></tr></thead>
    <tbody>
      <tr><td>Cost Adjustment</td><td class="right mono">${Number(doc.cost_change ?? 0) >= 0 ? '+' : ''}$${Number(doc.cost_change ?? 0).toLocaleString()}</td></tr>
      ${doc.schedule_change_days ? `<tr><td>Schedule Adjustment</td><td>${doc.schedule_change_days} days</td></tr>` : ''}
    </tbody>
  </table>

  ${options?.include_signature_block ? `
  <div class="signature-block">
    <div class="sig-line">
      <div class="sig-field">
        <div class="label">Client Approval</div>
        <div class="line"></div>
        <div class="name">Date: ____________</div>
      </div>
      <div class="sig-field">
        <div class="label">AK Renovations</div>
        <div class="line"></div>
        <div class="name">Adam Kilgore, Owner</div>
      </div>
    </div>
  </div>` : ''}

  ${brandedFooter(coNum)}
</body>
</html>`
}

function buildDailyLogHtml(doc: Record<string, unknown>): string {
  const proj = doc.projects as Record<string, unknown> | null
  const date = doc.log_date ? new Date(doc.log_date as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const logNum = `LOG-${date.replace(/[, ]/g, '-')}`

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head>
<body>
  ${brandedHeader('DAILY LOG', logNum, date)}

  <div class="cover-block">
    <h1>${proj?.title ?? 'Project'} — ${date}</h1>
  </div>

  <h2>Summary</h2>
  <p>${doc.summary as string ?? ''}</p>

  ${doc.work_completed ? `<h2>Work Completed</h2><p>${doc.work_completed as string}</p>` : ''}
  ${doc.issues ? `<h2>Issues / Notes</h2><p>${doc.issues as string}</p>` : ''}
  ${doc.weather ? `<h2>Weather</h2><p>${doc.weather as string}</p>` : ''}
  ${(doc.workers_on_site as string[] | null)?.length ? `<h2>Workers on Site</h2><p>${(doc.workers_on_site as string[]).join(', ')}</p>` : ''}

  ${brandedFooter(logNum)}
</body>
</html>`
}

// ── Main serve function ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'generate-pdf')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { document_type, document_id, options = {} } = parsedInput.data

    const supabase = createClient(supabaseUrl(), serviceKey())

    // Fetch document data
    const doc = await fetchDocumentData(supabase, document_type, document_id)
    if (!doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    // Build HTML
    let html = ''
    switch (document_type) {
      case 'invoice':      html = buildInvoiceHtml(doc as Record<string, unknown>, options); break
      case 'proposal':     html = buildProposalHtml(doc as Record<string, unknown>, options); break
      case 'contract':     html = buildContractHtml(doc as Record<string, unknown>, options); break
      case 'change_order': html = buildChangeOrderHtml(doc as Record<string, unknown>, options); break
      case 'daily_log':    html = buildDailyLogHtml(doc as Record<string, unknown>); break
      default:
        html = `<html><body><h1>${document_type}</h1><pre>${JSON.stringify(doc, null, 2)}</pre></body></html>`
    }

    // Determine storage path
    const storagePathMap: Record<string, string> = {
      invoice:      `invoices/${document_id}${options?.watermark === 'PAID' ? '-paid' : ''}.html`,
      proposal:     `proposals/${document_id}.html`,
      contract:     `contracts/${document_id}${doc.status === 'signed' ? '-signed' : ''}.html`,
      change_order: `change_orders/${document_id}.html`,
      daily_log:    `daily_logs/${document_id}.html`,
    }
    const storagePath = storagePathMap[document_type] ?? `${document_type}s/${document_id}.html`

    // Upload HTML to storage (acts as the renderable document)
    const htmlBytes = new TextEncoder().encode(html)
    const { data: storageData } = await supabase.storage
      .from('documents')
      .upload(storagePath, htmlBytes, {
        contentType: 'text/html',
        upsert: true,
      })

    // Get public/signed URL
    const { data: urlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600) // 1 hour

    const storageUrl = urlData?.signedUrl ?? ''

    // Update the source record with the storage URL
    const updateMap: Record<string, { table: string; column: string }> = {
      invoice:      { table: 'invoices',      column: 'pdf_url' },
      proposal:     { table: 'proposals',     column: 'pdf_url' },
      contract:     { table: 'contracts',     column: 'pdf_url' },
      change_order: { table: 'change_orders', column: 'pdf_url' },
      daily_log:    { table: 'daily_logs',    column: 'pdf_url' },
    }
    const updateInfo = updateMap[document_type]
    if (updateInfo) {
      await supabase.from(updateInfo.table).update({ [updateInfo.column]: storageUrl }).eq('id', document_id)
    }

    // Optionally sync to Drive (call sync-to-drive edge function)
    // Drive sync is fire-and-forget — don't block PDF generation on it
    const fileNameMap: Record<string, string> = {
      invoice:      `Invoice ${doc.invoice_number ?? document_id}.pdf`,
      proposal:     `Proposal — ${doc.title ?? document_id}.pdf`,
      contract:     `Contract${doc.status === 'signed' ? ' — Signed' : ''} — ${doc.title ?? document_id}.pdf`,
      change_order: `CO — ${doc.title ?? document_id}.pdf`,
      daily_log:    `${doc.log_date ?? 'Daily Log'}.pdf`,
    }
    const fileName = fileNameMap[document_type] ?? `${document_type}-${document_id}.pdf`

    // Fire-and-forget Drive sync
    fetch(`${supabaseUrl()}/functions/v1/sync-to-drive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey()}`,
      },
      body: JSON.stringify({
        html_content: html,
        file_name: fileName,
        document_type,
        document_id,
        project_id: (doc as Record<string, unknown>).project_id ?? null,
      }),
    }).catch(err => console.error('Drive sync fire-and-forget error:', err))

    return new Response(
      JSON.stringify({
        success: true,
        storage_url: storageUrl,
        storage_path: storagePath,
        html_length: html.length,
        file_name: fileName,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('generate-pdf error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})
