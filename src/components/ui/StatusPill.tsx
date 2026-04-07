import { cn } from '@/lib/utils'

type Status =
  | 'on_track' | 'at_risk' | 'behind' | 'ahead'
  | 'complete' | 'pending' | 'draft' | 'sent'
  | 'paid' | 'overdue' | 'active' | 'cancelled'
  | 'partial_paid' | 'signed' | 'accepted' | 'lead'
  | 'consultation' | 'proposal_sent' | 'contract_signed'
  | 'active_project' | 'lost'

const STATUS_CONFIG: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
  // Schedule
  on_track:        { label: 'On Track',        dot: 'bg-[var(--success)]',       bg: 'bg-[var(--success-bg)]',  text: 'text-[var(--success)]' },
  ahead:           { label: 'Ahead',            dot: 'bg-[var(--success)]',       bg: 'bg-[var(--success-bg)]',  text: 'text-[var(--success)]' },
  at_risk:         { label: 'At Risk',          dot: 'bg-[var(--warning)]',       bg: 'bg-[var(--warning-bg)]',  text: 'text-[var(--warning)]' },
  behind:          { label: 'Behind',           dot: 'bg-[var(--danger)]',        bg: 'bg-[var(--danger-bg)]',   text: 'text-[var(--danger)]' },
  overdue:         { label: 'Overdue',          dot: 'bg-[var(--danger)]',        bg: 'bg-[var(--danger-bg)]',   text: 'text-[var(--danger)]' },
  // Project / generic
  complete:        { label: 'Complete',         dot: 'bg-[var(--cream)]',         bg: 'bg-[var(--cream-light)]', text: 'text-[var(--text-secondary)]' },
  cancelled:       { label: 'Cancelled',        dot: 'bg-[var(--text-tertiary)]', bg: 'bg-gray-50',              text: 'text-[var(--text-tertiary)]' },
  pending:         { label: 'Pending',          dot: 'bg-[var(--text-tertiary)]', bg: 'bg-gray-50',              text: 'text-[var(--text-tertiary)]' },
  draft:           { label: 'Draft',            dot: 'bg-[var(--text-tertiary)]', bg: 'bg-gray-50',              text: 'text-[var(--text-tertiary)]' },
  active:          { label: 'Active',           dot: 'bg-[var(--navy)]',          bg: 'bg-blue-50',              text: 'text-[var(--navy)]' },
  // Invoices
  sent:            { label: 'Sent',             dot: 'bg-blue-400',               bg: 'bg-blue-50',              text: 'text-blue-600' },
  paid:            { label: 'Paid',             dot: 'bg-[var(--success)]',       bg: 'bg-[var(--success-bg)]',  text: 'text-[var(--success)]' },
  partial_paid:    { label: 'Partial Paid',     dot: 'bg-[var(--warning)]',       bg: 'bg-[var(--warning-bg)]',  text: 'text-[var(--warning)]' },
  // Contracts / proposals
  signed:          { label: 'Signed',           dot: 'bg-[var(--success)]',       bg: 'bg-[var(--success-bg)]',  text: 'text-[var(--success)]' },
  accepted:        { label: 'Accepted',         dot: 'bg-[var(--success)]',       bg: 'bg-[var(--success-bg)]',  text: 'text-[var(--success)]' },
  // CRM pipeline stages
  lead:            { label: 'New Lead',         dot: 'bg-[var(--text-tertiary)]', bg: 'bg-gray-50',              text: 'text-[var(--text-tertiary)]' },
  consultation:    { label: 'Consultation',     dot: 'bg-blue-400',               bg: 'bg-blue-50',              text: 'text-blue-600' },
  proposal_sent:   { label: 'Proposal Sent',   dot: 'bg-[var(--warning)]',       bg: 'bg-[var(--warning-bg)]',  text: 'text-[var(--warning)]' },
  contract_signed: { label: 'Contract Signed', dot: 'bg-[var(--success)]',       bg: 'bg-[var(--success-bg)]',  text: 'text-[var(--success)]' },
  active_project:  { label: 'Active',           dot: 'bg-[var(--navy)]',          bg: 'bg-blue-50',              text: 'text-[var(--navy)]' },
  lost:            { label: 'Lost',             dot: 'bg-[var(--danger)]',        bg: 'bg-[var(--danger-bg)]',   text: 'text-[var(--danger)]' },
}

interface StatusPillProps {
  status: string
  className?: string
}

export function StatusPill({ status, className }: StatusPillProps) {
  const cfg = STATUS_CONFIG[status as Status] ?? STATUS_CONFIG.pending
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium',
        cfg.bg,
        cfg.text,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
