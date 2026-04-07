import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Clock, Calendar, Receipt, Camera,
  Gift, FileText, MessageCircle, Wallet, CheckSquare, Wrench
} from 'lucide-react'
import { MOCK_CHECKLIST_INSTANCE_ITEMS } from '@/data/mock'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { MOCK_SCHEDULE, MOCK_TIME_ENTRIES } from '@/data/mock'

const TODAY = '2026-04-07'
const CURRENT_USER = 'employee-1'

function greeting(name: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name.split(' ')[0]}.`
}

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function getTimeClockDesc(now: number) {
  const todayEntries = MOCK_TIME_ENTRIES.filter(
    e => (e as any).user_id === CURRENT_USER && e.clock_in.startsWith(TODAY)
  )
  const openEntry = todayEntries.find(e => e.clock_out === null)
  if (openEntry) {
    const elapsed = Math.floor((now - new Date(openEntry.clock_in).getTime()) / 60000)
    const proj = (openEntry as any).project_title ?? 'Overhead'
    return `${proj} · ${fmtDuration(elapsed)}`
  }
  if (todayEntries.length > 0) {
    const totalMins = todayEntries.reduce((sum, e) => sum + ((e as any).total_minutes ?? 0), 0)
    return `${todayEntries.length} segment${todayEntries.length > 1 ? 's' : ''} · ${fmtDuration(totalMins)} total`
  }
  return 'Not clocked in'
}

export function EmployeeHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = MOCK_SCHEDULE[0]
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeClockDesc = getTimeClockDesc(now)
  const checklistsPending = MOCK_CHECKLIST_INSTANCE_ITEMS.filter(
    (i) =>
      (i.assigned_to === CURRENT_USER ||
        (i.assigned_role === 'employee' && !i.assigned_to) ||
        i.assigned_role === 'any') &&
      i.status !== 'completed',
  ).length
  const todayEntries = MOCK_TIME_ENTRIES.filter(
    e => (e as any).user_id === CURRENT_USER && e.clock_in.startsWith(TODAY)
  )
  const openEntry = todayEntries.find(e => e.clock_out === null)

  const ACTION_CARDS = [
    { label: 'Shopping List', icon: ShoppingCart, to: '/employee/shopping',  badge: 4, desc: '4 items needed',       iconBg: 'bg-blue-50',                   iconColor: 'text-blue-600' },
    { label: 'Time Clock',    icon: Clock,        to: '/employee/time',       badge: 0, desc: timeClockDesc,          iconBg: openEntry ? 'bg-[var(--success-bg)]' : 'bg-[var(--cream-light)]', iconColor: openEntry ? 'text-[var(--success)]' : 'text-[var(--navy)]' },
    { label: 'Schedule',      icon: Calendar,     to: '/employee/schedule',   badge: 0, desc: 'Johnson Bath today',   iconBg: 'bg-[var(--cream-light)]',      iconColor: 'text-[var(--navy)]' },
    { label: 'Receipts',      icon: Receipt,      to: '/employee/receipts',   badge: 0, desc: 'Snap & submit',        iconBg: 'bg-[var(--warning-bg)]',       iconColor: 'text-[var(--warning)]' },
    { label: 'Photos',        icon: Camera,       to: '/employee/photos',     badge: 0, desc: 'Add progress photos',  iconBg: 'bg-purple-50',                 iconColor: 'text-purple-600' },
    { label: 'Bonus Tracker', icon: Gift,         to: '/employee/bonus',      badge: 0, desc: '$1,800 earned YTD',    iconBg: 'bg-[var(--rust-subtle)]',      iconColor: 'text-[var(--rust)]' },
    { label: 'Notes',         icon: FileText,     to: '/employee/notes',      badge: 0, desc: 'Logs & files',         iconBg: 'bg-[var(--cream-light)]',      iconColor: 'text-[var(--navy)]' },
    { label: 'Messages',      icon: MessageCircle,to: '/employee/messages',   badge: 2, desc: '2 unread',             iconBg: 'bg-[var(--navy)]',             iconColor: 'text-white' },
    { label: 'My Paystubs',   icon: Wallet,       to: '/employee/paystubs',   badge: 0, desc: 'Earnings & taxes',     iconBg: 'bg-[var(--success-bg)]',       iconColor: 'text-[var(--success)]' },
    { label: 'Checklists',    icon: CheckSquare,  to: '/employee/checklists', badge: checklistsPending, desc: `${checklistsPending} items pending`, iconBg: 'bg-[var(--rust-subtle)]', iconColor: 'text-[var(--rust)]' },
    { label: 'Request Tool',  icon: Wrench,       to: '/employee/tool-request', badge: 0, desc: 'Need a tool?',         iconBg: 'bg-[var(--cream-light)]',      iconColor: 'text-[var(--navy)]' },
  ]

  return (
    <div className="p-4 space-y-5">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="font-display text-3xl text-[var(--navy)] leading-tight">
          {user ? greeting(user.full_name) : 'Welcome.'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Monday, April 6, 2026
        </p>
      </div>

      {/* Today's job */}
      {today && (
        <div className="bg-[var(--navy)] rounded-xl p-4">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1.5">Today's Job</p>
          <p className="text-white font-semibold text-base mb-0.5">{today.project}</p>
          <p className="text-white/70 text-sm mb-2">{today.task}</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--rust)]" />
            <p className="text-white/50 text-xs">{today.address}</p>
          </div>
        </div>
      )}

      {/* Action grid */}
      <div className="grid grid-cols-2 gap-3">
        {ACTION_CARDS.map(({ label, icon: Icon, to, badge, desc, iconBg, iconColor }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="bg-white rounded-xl border border-[var(--border-light)] p-4 text-left active:scale-[0.98] transition-transform hover:border-[var(--border)]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                <Icon size={20} className={iconColor} />
              </div>
              {badge > 0 && <Badge count={badge} />}
            </div>
            <p className="font-semibold text-sm text-[var(--text)]">{label}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">{desc}</p>
          </button>
        ))}
      </div>

      <div className="h-4" />
    </div>
  )
}
