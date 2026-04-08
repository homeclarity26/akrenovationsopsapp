import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Clock, Calendar, Receipt, Camera,
  Gift, FileText, MessageCircle, Wallet, CheckSquare, Wrench
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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

export function EmployeeHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())
  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Shopping badge count
  const { data: shoppingCount = 0 } = useQuery({
    queryKey: ['shopping-needed-count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('shopping_list_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'needed')
      return count ?? 0
    },
  })

  // Today's schedule event
  const { data: todayEvent } = useQuery({
    queryKey: ['today-schedule', user?.id, todayStr],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('schedule_events')
        .select('*, projects(title, address)')
        .eq('start_date', todayStr)
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
  })

  // Today's time entries for clock status
  const { data: todayEntries = [] } = useQuery({
    queryKey: ['today-time-entries', user?.id, todayStr],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', user!.id)
        .gte('clock_in', `${todayStr}T00:00:00`)
        .lte('clock_in', `${todayStr}T23:59:59`)
      return data ?? []
    },
  })

  // Checklist pending count
  const { data: checklistsPending = 0 } = useQuery({
    queryKey: ['checklist-pending-count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('checklist_instance_items')
        .select('*', { count: 'exact', head: true })
        .neq('is_completed', true)
      return count ?? 0
    },
  })

  const openEntry = todayEntries.find((e: any) => e.clock_out === null)

  function getTimeClockDesc() {
    if (openEntry) {
      const elapsed = Math.floor((now - new Date((openEntry as any).clock_in).getTime()) / 60000)
      return `Clocked in · ${fmtDuration(elapsed)}`
    }
    if (todayEntries.length > 0) {
      const totalMins = todayEntries.reduce((sum: number, e: any) => sum + (e.total_hours ? Math.round(e.total_hours * 60) : 0), 0)
      return `${todayEntries.length} segment${todayEntries.length > 1 ? 's' : ''} · ${fmtDuration(totalMins)} total`
    }
    return 'Not clocked in'
  }

  const timeClockDesc = getTimeClockDesc()
  const todayProject = todayEvent ? ((todayEvent as any).projects?.title ?? todayEvent.title) : null
  const todayAddress = todayEvent ? ((todayEvent as any).projects?.address ?? '') : ''

  const ACTION_CARDS = [
    { label: 'Shopping List', icon: ShoppingCart, to: '/employee/shopping',  badge: shoppingCount, desc: shoppingCount > 0 ? `${shoppingCount} items needed` : 'All clear', iconBg: 'bg-blue-50',                   iconColor: 'text-blue-600' },
    { label: 'Time Clock',    icon: Clock,        to: '/employee/time',       badge: 0, desc: timeClockDesc,          iconBg: openEntry ? 'bg-[var(--success-bg)]' : 'bg-[var(--cream-light)]', iconColor: openEntry ? 'text-[var(--success)]' : 'text-[var(--navy)]' },
    { label: 'Schedule',      icon: Calendar,     to: '/employee/schedule',   badge: 0, desc: todayProject ?? 'No job today', iconBg: 'bg-[var(--cream-light)]', iconColor: 'text-[var(--navy)]' },
    { label: 'Receipts',      icon: Receipt,      to: '/employee/receipts',   badge: 0, desc: 'Snap & submit',        iconBg: 'bg-[var(--warning-bg)]',       iconColor: 'text-[var(--warning)]' },
    { label: 'Photos',        icon: Camera,       to: '/employee/photos',     badge: 0, desc: 'Add progress photos',  iconBg: 'bg-purple-50',                 iconColor: 'text-purple-600' },
    { label: 'Bonus Tracker', icon: Gift,         to: '/employee/bonus',      badge: 0, desc: 'Track your earnings',  iconBg: 'bg-[var(--rust-subtle)]',      iconColor: 'text-[var(--rust)]' },
    { label: 'Notes',         icon: FileText,     to: '/employee/notes',      badge: 0, desc: 'Logs & files',         iconBg: 'bg-[var(--cream-light)]',      iconColor: 'text-[var(--navy)]' },
    { label: 'Messages',      icon: MessageCircle,to: '/employee/messages',   badge: 0, desc: 'Team messages',        iconBg: 'bg-[var(--navy)]',             iconColor: 'text-white' },
    { label: 'My Paystubs',   icon: Wallet,       to: '/employee/paystubs',   badge: 0, desc: 'Earnings & taxes',     iconBg: 'bg-[var(--success-bg)]',       iconColor: 'text-[var(--success)]' },
    { label: 'Checklists',    icon: CheckSquare,  to: '/employee/checklists', badge: checklistsPending, desc: checklistsPending > 0 ? `${checklistsPending} items pending` : 'All clear', iconBg: 'bg-[var(--rust-subtle)]', iconColor: 'text-[var(--rust)]' },
    { label: 'Request Tool',  icon: Wrench,       to: '/employee/tool-request', badge: 0, desc: 'Need a tool?',       iconBg: 'bg-[var(--cream-light)]',      iconColor: 'text-[var(--navy)]' },
  ]

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-4 space-y-5">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="font-display text-3xl text-[var(--navy)] leading-tight">
          {user ? greeting(user.full_name) : 'Welcome.'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {dateLabel}
        </p>
      </div>

      {/* Today's job */}
      {todayEvent && (
        <div className="bg-[var(--navy)] rounded-xl p-4">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1.5">Today's Job</p>
          <p className="text-white font-semibold text-base mb-0.5">{todayProject}</p>
          <p className="text-white/70 text-sm mb-2">{todayEvent.title}</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--rust)]" />
            <p className="text-white/50 text-xs">{todayAddress}</p>
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
