import { useNavigate, Link } from 'react-router-dom'
import {
  Clock, ShoppingCart, Calendar, Receipt, Camera,
  StickyNote, MessageSquare, Trophy, CheckCircle2, ArrowLeft
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export function FieldLaunchpadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Shopping list — items still needed
  const { data: shoppingCount = 0 } = useQuery({
    queryKey: ['field-shopping-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('shopping_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'needed')
      return count ?? 0
    },
  })

  // Unread messages for this user
  const { data: messageCount = 0 } = useQuery({
    queryKey: ['field-message-count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user!.id)
        .eq('is_read', false)
      return count ?? 0
    },
  })

  // Pending approvals
  const { data: approvalCount = 0 } = useQuery({
    queryKey: ['field-approval-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_actions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('requires_approval', true)
      return count ?? 0
    },
  })

  // Open clock-in (no clock_out yet)
  const { data: clockedIn = false } = useQuery({
    queryKey: ['field-clocked-in', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('id')
        .eq('employee_id', user!.id)
        .is('clock_out', null)
        .limit(1)
      return (data?.length ?? 0) > 0
    },
  })

  // Today's schedule event
  const { data: todayEvent = null } = useQuery({
    queryKey: ['field-today-event'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('schedule_events')
        .select('title')
        .eq('start_date', today)
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle()
      return data
    },
  })

  const CARDS = [
    {
      label: 'Time Clock',
      icon: Clock,
      to: '/employee/time',
      badge: 0,
      desc: clockedIn ? 'Clocked in' : 'Not clocked in',
      iconBg: 'bg-[var(--success-bg)]',
      iconColor: 'text-[var(--success)]',
    },
    {
      label: 'Shopping List',
      icon: ShoppingCart,
      to: '/employee/shopping',
      badge: shoppingCount,
      desc: shoppingCount > 0 ? `${shoppingCount} item${shoppingCount !== 1 ? 's' : ''} needed` : 'All clear',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Schedule',
      icon: Calendar,
      to: '/employee/schedule',
      badge: 0,
      desc: todayEvent ? todayEvent.title : 'No events today',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Receipts',
      icon: Receipt,
      to: '/employee/receipts',
      badge: 0,
      desc: 'Scan & upload',
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
    {
      label: 'Photos',
      icon: Camera,
      to: '/employee/photos',
      badge: 0,
      desc: 'Camera-first upload',
      iconBg: 'bg-pink-50',
      iconColor: 'text-pink-600',
    },
    {
      label: 'Notes',
      icon: StickyNote,
      to: '/employee/notes',
      badge: 0,
      desc: 'Project notes & flags',
      iconBg: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
    },
    {
      label: 'Messages',
      icon: MessageSquare,
      to: '/employee/messages',
      badge: messageCount,
      desc: messageCount > 0 ? `${messageCount} unread` : 'No new messages',
      iconBg: 'bg-[var(--cream-light)]',
      iconColor: 'text-[var(--navy)]',
    },
    {
      label: 'Bonus',
      icon: Trophy,
      to: '/employee/bonus',
      badge: 0,
      desc: 'Bonus tracker',
      iconBg: 'bg-[var(--rust-subtle)]',
      iconColor: 'text-[var(--rust)]',
    },
    {
      label: 'Approvals',
      icon: CheckCircle2,
      to: '/admin/settings/approvals',
      badge: approvalCount,
      desc: approvalCount > 0 ? `${approvalCount} pending` : 'All clear',
      iconBg: 'bg-[var(--danger-bg)]',
      iconColor: 'text-[var(--danger)]',
    },
  ]

  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] ?? 'Adam'

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Field mode banner */}
      <div className="bg-[var(--rust)] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-sm font-semibold">Field mode active</span>
        </div>
        <Link to="/admin" className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>
      </div>

      <div className="p-4 space-y-5 pb-24">
        {/* Greeting */}
        <div className="pt-2">
          <h1 className="font-display text-2xl text-[var(--navy)]">{greeting}, {firstName}.</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Field mode · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* 3x3 action grid */}
        <div className="grid grid-cols-3 gap-3">
          {CARDS.map(card => {
            const Icon = card.icon
            return (
              <button
                key={card.label}
                onClick={() => navigate(card.to)}
                className="relative bg-white rounded-2xl p-3 border border-[var(--border-light)] flex flex-col items-center text-center active:scale-95 transition-transform"
              >
                {card.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[var(--rust)] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {card.badge}
                  </span>
                )}
                <div className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center mb-2`}>
                  <Icon size={22} className={card.iconColor} />
                </div>
                <p className="text-[11px] font-semibold text-[var(--text)] leading-tight">{card.label}</p>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 leading-tight line-clamp-1">{card.desc}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
