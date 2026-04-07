import { useState } from 'react'
import { Heart, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function ClientReferral() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [projectType, setProjectType] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <Card>
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-14 h-14 rounded-full bg-[var(--success-bg)] flex items-center justify-center mb-3">
              <Check size={26} className="text-[var(--success)]" />
            </div>
            <p className="font-display text-2xl text-[var(--navy)] mb-1">Thank you</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Adam will reach out to {name} this week. Means the world to us.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <div className="text-center pt-2">
        <div className="w-12 h-12 rounded-full bg-[var(--rust-subtle)] flex items-center justify-center mx-auto mb-3">
          <Heart size={22} className="text-[var(--rust)]" />
        </div>
        <h1 className="font-display text-3xl text-[var(--navy)]">Refer a friend</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2 px-4">
          You trusted us with your home. If someone you know could use our help, we would love the introduction.
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              Their name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              Their phone number
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(330) 555-0000"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              Their email (optional)
            </label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              What are they looking to do?
            </label>
            <Input
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              placeholder="Kitchen, bathroom, addition..."
            />
          </div>

          <Button
            className="w-full"
            disabled={!name.trim() || !phone.trim() || !projectType.trim()}
            onClick={() => setSubmitted(true)}
          >
            Submit referral
          </Button>
        </div>
      </Card>

      <p className="text-center text-[11px] text-[var(--text-tertiary)]">
        Questions? Text us at (330) 555-0100.
      </p>
    </div>
  )
}
