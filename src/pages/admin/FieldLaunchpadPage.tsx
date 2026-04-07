import { useNavigate, Link } from 'react-router-dom'
import {
  Clock, ShoppingCart, Calendar, Receipt, Camera,
  StickyNote, MessageSquare, Trophy, CheckCircle2, ArrowLeft
} from 'lucide-react'

interface ActionCard {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  to: string
  badge: number
  desc: string
  iconBg: string
  iconColor: string
}

export function FieldLaunchpadPage() {
  const navigate = useNavigate()

  const CARDS: ActionCard[] = [
    { label: 'Time Clock',    icon: Clock,         to: '/employee/time',              badge: 0,  desc: 'Not clocked in',              iconBg: 'bg-[var(--success-bg)]',   iconColor: 'text-[var(--success)]' },
    { label: 'Shopping List', icon: ShoppingCart,  to: '/employee/shopping',          badge: 7,  desc: '7 items needed',              iconBg: 'bg-blue-50',               iconColor: 'text-blue-600' },
    { label: 'Schedule',      icon: Calendar,      to: '/employee/schedule',          badge: 0,  desc: 'Thompson Addition today',      iconBg: 'bg-purple-50',             iconColor: 'text-purple-600' },
    { label: 'Receipts',      icon: Receipt,       to: '/employee/receipts',          badge: 0,  desc: 'Scan & upload',               iconBg: 'bg-orange-50',             iconColor: 'text-orange-600' },
    { label: 'Photos',        icon: Camera,        to: '/employee/photos',            badge: 0,  desc: 'Camera-first upload',         iconBg: 'bg-pink-50',               iconColor: 'text-pink-600' },
    { label: 'Notes',         icon: StickyNote,    to: '/employee/notes',             badge: 0,  desc: 'Project notes & flags',       iconBg: 'bg-yellow-50',             iconColor: 'text-yellow-600' },
    { label: 'Messages',      icon: MessageSquare, to: '/employee/messages',          badge: 2,  desc: '2 unread',                    iconBg: 'bg-[var(--cream-light)]',  iconColor: 'text-[var(--navy)]' },
    { label: 'Bonus',         icon: Trophy,        to: '/employee/bonus',             badge: 0,  desc: '$0 earned YTD',               iconBg: 'bg-[var(--rust-subtle)]',  iconColor: 'text-[var(--rust)]' },
    { label: 'Approvals',     icon: CheckCircle2,  to: '/admin/settings/approvals',   badge: 3,  desc: '3 pending',                   iconBg: 'bg-[var(--danger-bg)]',    iconColor: 'text-[var(--danger)]' },
  ]

  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

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
          <h1 className="font-display text-2xl text-[var(--navy)]">{greeting}, Adam.</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Field mode · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
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
