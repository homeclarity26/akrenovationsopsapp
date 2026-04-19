// Reusable share menu for proposals, invoices, and contracts.
//
// Rendering: a single primary "Share" button that expands inline into four
// actions — Download PDF (triggers print-to-PDF), Email, SMS, Copy link. Also
// surfaces the already-existing "Download .docx" action so callers don't need
// to render two buttons.
//
// Behavior:
//   - "Download PDF" calls window.print() after setting a .print-ready class
//     on <body>. Works against whatever the current page is rendering.
//   - "Download .docx" runs the caller-provided docx builder and downloads.
//   - "Email" and "SMS" first run the docx builder → upload to the documents
//     storage bucket → sign a 7-day URL → call send-email / send-sms with the
//     link embedded in the message.
//   - "Copy link" does the upload/sign step and copies the signed URL to the
//     clipboard.

import { useState } from 'react'
import { Share2, Download, FileText, Mail, MessageSquareText, Link2, Loader2, X, Check } from 'lucide-react'
import { uploadBlobForShare, sendShareEmail, sendShareSms, type ShareDocKind } from '@/lib/shareDoc'

interface ShareMenuProps {
  /** The kind of document being shared — used for storage path prefix. */
  kind: ShareDocKind
  /** DB id for the document — used as folder name in the documents bucket. */
  documentId: string
  /** Display name for the document (used in share subject/body). */
  documentTitle: string
  /** Default recipient (if we know the client's email). */
  defaultEmail?: string
  /** Default recipient (if we know the client's phone). */
  defaultPhone?: string
  /** Builder that returns the docx blob for upload/attach. */
  buildDocx: () => Promise<{ blob: Blob; filename: string }>
  /** Optional PDF builder — if omitted, "Download PDF" triggers window.print(). */
  buildPdf?: () => Promise<{ blob: Blob; filename: string }>
}

type BusyAction = 'pdf' | 'docx' | 'email' | 'sms' | 'link' | null

export function ShareMenu({
  kind,
  documentId,
  documentTitle,
  defaultEmail,
  defaultPhone,
  buildDocx,
  buildPdf,
}: ShareMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [showSms, setShowSms] = useState(false)
  const [emailTo, setEmailTo] = useState(defaultEmail ?? '')
  const [emailNote, setEmailNote] = useState('')
  const [smsTo, setSmsTo] = useState(defaultPhone ?? '')
  const [smsNote, setSmsNote] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const show = (msg: string) => {
    setError(null)
    setFlash(msg)
    setTimeout(() => setFlash(null), 3000)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const onPdf = async () => {
    setBusy('pdf')
    try {
      if (buildPdf) {
        const { blob, filename } = await buildPdf()
        downloadBlob(blob, filename)
      } else {
        // No server PDF available — browser print-to-PDF.
        window.print()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\u2019t generate PDF')
    } finally {
      setBusy(null)
    }
  }

  const onDocx = async () => {
    setBusy('docx')
    try {
      const { blob, filename } = await buildDocx()
      downloadBlob(blob, filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\u2019t build document')
    } finally {
      setBusy(null)
    }
  }

  const onCopyLink = async () => {
    setBusy('link')
    try {
      const { blob, filename } = await buildDocx()
      const { url } = await uploadBlobForShare(blob, filename, kind, documentId)
      await navigator.clipboard.writeText(url)
      show('Link copied — valid for 7 days')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\u2019t create link')
    } finally {
      setBusy(null)
    }
  }

  const onSendEmail = async () => {
    if (!emailTo.trim()) { setError('Enter a recipient email'); return }
    setBusy('email')
    try {
      const { blob, filename } = await buildDocx()
      const { url } = await uploadBlobForShare(blob, filename, kind, documentId)
      const body = emailNote.trim() || `Hi — I've attached the ${kind} for your project.\nLet me know if you have any questions.\n\n— Adam, AK Renovations`
      const result = await sendShareEmail({
        to: emailTo.trim(),
        subject: `${documentTitle} — ${kind}`,
        body,
        attachmentUrl: url,
      })
      if (!result.ok) throw new Error(result.message ?? 'send-email failed')
      show('Email sent')
      setShowEmail(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\u2019t send email')
    } finally {
      setBusy(null)
    }
  }

  const onSendSms = async () => {
    if (!smsTo.trim()) { setError('Enter a recipient phone'); return }
    setBusy('sms')
    try {
      const { blob, filename } = await buildDocx()
      const { url } = await uploadBlobForShare(blob, filename, kind, documentId)
      const note = smsNote.trim() || `Here's the ${kind} for your project:`
      const result = await sendShareSms({
        to: smsTo.trim(),
        body: `${note} ${url}`,
      })
      if (!result.ok) throw new Error(result.message ?? 'send-sms failed')
      show('SMS sent')
      setShowSms(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\u2019t send SMS')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[var(--navy)] text-white px-3 py-2 rounded-xl min-h-[36px] hover:opacity-90 transition-opacity"
        aria-expanded={open}
      >
        <Share2 size={14} />
        Share
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-40 w-56 bg-white border border-[var(--border)] rounded-xl shadow-lg p-1"
          onBlur={() => setOpen(false)}
        >
          <MenuItem
            icon={busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            label={buildPdf ? 'Download PDF' : 'Print / Save as PDF'}
            onClick={() => { setOpen(false); onPdf() }}
            disabled={!!busy}
          />
          <MenuItem
            icon={busy === 'docx' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            label="Download .docx"
            onClick={() => { setOpen(false); onDocx() }}
            disabled={!!busy}
          />
          <MenuItem
            icon={<Mail size={14} />}
            label="Email to client"
            onClick={() => { setOpen(false); setShowEmail(true) }}
            disabled={!!busy}
          />
          <MenuItem
            icon={<MessageSquareText size={14} />}
            label="Text to client"
            onClick={() => { setOpen(false); setShowSms(true) }}
            disabled={!!busy}
          />
          <MenuItem
            icon={busy === 'link' ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            label="Copy shareable link"
            onClick={() => { setOpen(false); onCopyLink() }}
            disabled={!!busy}
          />
        </div>
      )}

      {(flash || error) && (
        <div className={`absolute right-0 top-full mt-12 z-50 text-xs px-3 py-2 rounded-xl shadow-md whitespace-nowrap ${error ? 'bg-[var(--danger)] text-white' : 'bg-[var(--navy)] text-white'}`}>
          {error ? (
            <span className="inline-flex items-center gap-1.5"><X size={12} /> {error}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Check size={12} /> {flash}</span>
          )}
        </div>
      )}

      {showEmail && (
        <Sheet title="Email to client" onClose={() => setShowEmail(false)}>
          <LabeledInput label="Recipient email" value={emailTo} onChange={setEmailTo} placeholder="client@example.com" type="email" />
          <LabeledTextarea label="Message" value={emailNote} onChange={setEmailNote} placeholder="Optional note — we'll attach the download link automatically." />
          <button
            onClick={onSendEmail}
            disabled={busy === 'email'}
            className="w-full py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy === 'email' ? 'Sending…' : 'Send email'}
          </button>
        </Sheet>
      )}

      {showSms && (
        <Sheet title="Text to client" onClose={() => setShowSms(false)}>
          <LabeledInput label="Recipient phone" value={smsTo} onChange={setSmsTo} placeholder="+1 330-555-0100" type="tel" />
          <LabeledTextarea label="Short message" value={smsNote} onChange={setSmsNote} placeholder={`Here's the ${kind} for your project:`} />
          <button
            onClick={onSendSms}
            disabled={busy === 'sms'}
            className="w-full py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy === 'sms' ? 'Sending…' : 'Send text'}
          </button>
        </Sheet>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text)]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-[var(--text-tertiary)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function LabeledInput({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">{label}</label>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30"
      />
    </div>
  )
}

function LabeledTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm resize-none"
      />
    </div>
  )
}
