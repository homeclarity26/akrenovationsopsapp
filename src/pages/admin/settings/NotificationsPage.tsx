// NotificationsPage — per-user notification channel + sound preferences.
// Mounted under /admin/settings/notifications.

import { useEffect, useState } from 'react'
import { Save, Volume2, VolumeX } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/context/AuthContext'
import { useNotifications, useUpdateNotificationPreferences } from '@/hooks/useNotifications'

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'America/New_York'
  }
}

export function NotificationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { preferences } = useNotifications()
  const update = useUpdateNotificationPreferences()

  const [inApp, setInApp] = useState(true)
  const [email, setEmail] = useState(true)
  const [sms, setSms] = useState(false)
  const [sound, setSound] = useState(true)
  const [timezone, setTimezone] = useState<string>('')

  useEffect(() => {
    setInApp(preferences.in_app !== false)
    setEmail(preferences.email !== false)
    setSms(preferences.sms === true)
    setSound(preferences.sound !== false)
  }, [preferences])

  useEffect(() => {
    // Load current timezone (falls back to browser).
    setTimezone(browserTimezone())
  }, [])

  async function handleSave() {
    try {
      await update.mutateAsync({
        in_app: inApp,
        email,
        sms,
        sound,
        timezone: timezone || null,
      })
      toast.success('Preferences saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preferences')
    }
  }

  if (!user) return null

  const allOff = !inApp && !email && !sms

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" subtitle="Choose how and when you hear from the app." />

      <Card className="p-4 space-y-4">
        <div>
          <h3 className="font-display text-sm text-[var(--navy)] mb-2">Channels</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">
            Turn channels on or off for every reminder and alert.
          </p>

          <label className="flex items-center justify-between py-2 border-b border-[var(--border-light)]">
            <div>
              <div className="text-sm font-medium">In-app</div>
              <div className="text-xs text-[var(--text-tertiary)]">Bell icon in the header</div>
            </div>
            <input
              type="checkbox"
              checked={inApp}
              onChange={(e) => setInApp(e.target.checked)}
              className="h-5 w-5 accent-[var(--navy)]"
            />
          </label>

          <label className="flex items-center justify-between py-2 border-b border-[var(--border-light)]">
            <div>
              <div className="text-sm font-medium">Email</div>
              <div className="text-xs text-[var(--text-tertiary)]">Sent to {user.email}</div>
            </div>
            <input
              type="checkbox"
              checked={email}
              onChange={(e) => setEmail(e.target.checked)}
              className="h-5 w-5 accent-[var(--navy)]"
            />
          </label>

          <label className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium">SMS</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                Text messages — Twilio integration (arriving in a later release)
              </div>
            </div>
            <input
              type="checkbox"
              checked={sms}
              onChange={(e) => setSms(e.target.checked)}
              disabled
              className="h-5 w-5 accent-[var(--navy)] opacity-60"
            />
          </label>
        </div>

        <div className="pt-3 border-t border-[var(--border-light)]">
          <h3 className="font-display text-sm text-[var(--navy)] mb-2">Sound</h3>
          <label className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                {sound ? <Volume2 size={14} /> : <VolumeX size={14} />} Play a chime on new notifications
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">Only when the app is open in your browser</div>
            </div>
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => setSound(e.target.checked)}
              className="h-5 w-5 accent-[var(--navy)]"
            />
          </label>
        </div>

        <div className="pt-3 border-t border-[var(--border-light)]">
          <h3 className="font-display text-sm text-[var(--navy)] mb-2">Time zone</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-2">
            Used when the AI parses &quot;remind me at 8am&quot; into an exact time.
          </p>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/New_York"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-sm"
          />
        </div>

        {allOff && (
          <div className="text-xs text-[var(--rust)] bg-red-50 border border-red-100 rounded-lg p-2">
            All channels are off — you won&apos;t receive reminders or alerts until at least one is enabled.
          </div>
        )}

        <div className="pt-2 flex items-center gap-2">
          <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={update.isPending}>
            <Save size={14} /> {update.isPending ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default NotificationsPage
