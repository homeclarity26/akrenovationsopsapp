// Admin button + inline form that invites the project's client to the portal.
// Calls the `invite-client-to-portal` edge function, which finds-or-creates a
// client profile, links projects.client_user_id, and sends a magic link via
// email (or returns the link for manual send if method='sms').
//
// Rendered on the ProjectDetailPage Client card in the Overview tab.
// Visible only when project.client_user_id is NULL — otherwise shows a small
// "Portal active" chip with the linked date.

import { useState } from 'react'
import { UserPlus, Check, Loader } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

// Copy + Text-it success block shared with the employee invite flow. Parent
// handles the 'email' / 'manual' / 'sms' variants; all three now surface the
// magic link with a Copy button so the admin can always grab it, and a
// SMS deep-link button when we have a phone hint or the user chose 'sms'.
function InviteResultCard({
  result,
  clientName,
  method,
}: {
  result: { kind: 'ok'; sent_via: string; link: string }
  clientName: string
  method: 'email' | 'sms'
}) {
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(result.link)
      else {
        const ta = document.createElement('textarea')
        ta.value = result.link
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      // eslint-disable-next-line no-alert
      alert('Invite link copied. Paste it into Messages / iMessage.')
    } catch {
      // ignore — user can long-press the link block below to select it
    }
  }
  const smsBody = `Hi ${clientName}, your AK Renovations project portal is ready. Tap to sign in (link is single-use): ${result.link}`
  const smsHref = `sms:&body=${encodeURIComponent(smsBody)}`
  const headline =
    result.sent_via === 'email' ? 'Invite email sent.'
      : method === 'sms' ? 'Share this link with the client:'
      : 'Email could not be sent — share this link with the client:'
  return (
    <div className="text-xs p-2 rounded-md bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success)]/20 space-y-2">
      <p className="font-semibold">{headline}</p>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={copy}
          className="px-2.5 py-1 rounded bg-[var(--navy)] text-white font-semibold"
        >
          Copy link
        </button>
        <a
          href={smsHref}
          className="px-2.5 py-1 rounded bg-[var(--rust)] text-white font-semibold no-underline"
        >
          Text it
        </a>
      </div>
      <div className="text-[10px] text-[var(--text-secondary)] break-all bg-white rounded p-2 font-mono border border-[var(--border-light)]">
        {result.link}
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)]">
        Single-use link. If it expires before they open it, re-invite and a new one is generated.
      </p>
    </div>
  )
}

interface Props {
  projectId: string
  clientUserId: string | null
  clientName: string | null
  clientEmail: string | null
  /** Called after a successful invite so the parent can refetch the project row. */
  onInvited?: () => void
}

export function InviteClientToPortal({ projectId, clientUserId, clientName, clientEmail, onInvited }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(clientName ?? '')
  const [email, setEmail] = useState(clientEmail ?? '')
  const [method, setMethod] = useState<'email' | 'sms'>('email')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<
    | { kind: 'ok'; sent_via: string; link: string }
    | { kind: 'err'; message: string }
    | null
  >(null)

  if (clientUserId) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--success)] bg-[var(--success-bg)] rounded-full px-2 py-1">
        <Check size={12} />
        Portal active
      </span>
    )
  }

  const submit = async () => {
    const emailClean = email.trim()
    const nameClean = name.trim()
    if (!emailClean || !nameClean) {
      setResult({ kind: 'err', message: 'Name and email are required.' })
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('invite-client-to-portal', {
        body: {
          project_id: projectId,
          client_email: emailClean,
          client_full_name: nameClean,
          method,
        },
      })
      if (error) throw error
      if (!data?.ok) {
        throw new Error(data?.error ?? 'Invite failed')
      }
      setResult({ kind: 'ok', sent_via: data.sent_via, link: data.link })
      onInvited?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setResult({ kind: 'err', message: msg })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--navy)] bg-[var(--cream-light)] border border-[var(--border-light)] rounded-full px-2.5 py-1 hover:bg-[var(--cream)] transition-colors"
      >
        <UserPlus size={12} />
        Invite to portal
      </button>
    )
  }

  return (
    <div className="mt-2 p-3 bg-[var(--cream-light)] rounded-lg border border-[var(--border-light)] space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        Invite client to portal
      </p>
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client full name"
          className="w-full px-2.5 py-1.5 text-sm rounded-md border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--navy)]"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="client@example.com"
          className="w-full px-2.5 py-1.5 text-sm rounded-md border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--navy)]"
        />
        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="method"
              value="email"
              checked={method === 'email'}
              onChange={() => setMethod('email')}
            />
            <span className="text-[var(--text)]">Email</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="method"
              value="sms"
              checked={method === 'sms'}
              onChange={() => setMethod('sms')}
            />
            <span className="text-[var(--text)]">SMS</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader size={12} className="animate-spin" /> Sending...
            </>
          ) : (
            'Send invite'
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setResult(null) }}>
          Cancel
        </Button>
      </div>

      {result?.kind === 'ok' && <InviteResultCard result={result} clientName={name} method={method} />}
      {result?.kind === 'err' && (
        <p className="text-xs p-2 rounded-md bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger)]/20">
          {result.message}
        </p>
      )}
    </div>
  )
}
