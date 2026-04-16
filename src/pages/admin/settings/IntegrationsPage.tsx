// IntegrationsPage — QuickBooks Online connection management
// Part of Settings > Integrations. Shows connect/disconnect/sync controls.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { RefreshCw, Plug, Unplug, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface Integration {
  id: string
  provider: string
  is_active: boolean
  last_synced_at: string | null
  realm_id: string | null
  created_at: string
}

interface SyncResult {
  invoices_synced: number
  expenses_synced: number
  payments_pulled: number
  errors: string[]
}

export function IntegrationsPage() {
  const { user } = useAuth()
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gustoIntegration, setGustoIntegration] = useState<Integration | null>(null)

  const loadIntegration = useCallback(async () => {
    if (!user?.company_id) return
    const { data } = await supabase
      .from('integrations')
      .select('id, provider, is_active, last_synced_at, realm_id, created_at')
      .eq('company_id', user.company_id)
      .eq('provider', 'gusto')
      .eq('is_active', true)
      .maybeSingle()
    setGustoIntegration(data)
  }, [user?.company_id])

  const fetchIntegration = useCallback(async () => {
    if (!user?.company_id) return
    setLoading(true)
    const { data } = await supabase
      .from('integrations')
      .select('id, provider, is_active, last_synced_at, realm_id, created_at')
      .eq('company_id', user.company_id)
      .eq('provider', 'quickbooks')
      .eq('is_active', true)
      .maybeSingle()
    setIntegration(data)
    setLoading(false)
  }, [user?.company_id])

  useEffect(() => { fetchIntegration(); loadIntegration() }, [fetchIntegration, loadIntegration])

  // Handle OAuth callback params if present
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('qb_connected') === 'true') {
      // Clean up URL
      url.searchParams.delete('qb_connected')
      window.history.replaceState({}, '', url.pathname)
      fetchIntegration()
    }
  }, [fetchIntegration])

  const handleConnect = async () => {
    if (!user?.company_id) return
    setConnecting(true)
    setError(null)
    try {
      const state = btoa(JSON.stringify({ company_id: user.company_id, user_id: user.id }))
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
      const res = await fetch(`${supabaseUrl}/functions/v1/quickbooks-auth?action=connect&state=${state}`, {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
        },
      })

      if (!res.ok) throw new Error('Failed to start OAuth flow')
      const result = await res.json()
      if (result.authorize_url) {
        window.location.href = result.authorize_url
      } else {
        throw new Error('No authorize URL returned')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setLastResult(null)
    try {
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-quickbooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({}),
      })

      if (!res.ok) throw new Error(`Sync failed: ${res.status}`)
      const result: SyncResult = await res.json()
      setLastResult(result)
      await fetchIntegration() // Refresh last_synced_at
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!integration) return
    setDisconnecting(true)
    setError(null)
    try {
      const { error: updateErr } = await supabase
        .from('integrations')
        .update({ is_active: false })
        .eq('id', integration.id)

      if (updateErr) throw new Error(updateErr.message)
      setIntegration(null)
      setLastResult(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  const isConnected = !!integration

  return (
    <div className="space-y-6 mt-2">
      <div>
        <h2 className="font-display text-lg text-[var(--text)]">Integrations</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Connect third-party services to sync your data automatically.
        </p>
      </div>

      {/* QuickBooks Card */}
      <div className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-4 border-b border-[var(--border-light)]">
          <div className="w-10 h-10 rounded-xl bg-[#2CA01C]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-[#2CA01C]">QB</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-[var(--text)]">QuickBooks Online</h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Sync invoices, expenses, and payments
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isConnected
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        <div className="px-5 py-4 space-y-4">
          {isConnected && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--text-tertiary)] text-xs">Realm ID</span>
                <p className="font-mono text-xs mt-0.5">{integration.realm_id ?? 'N/A'}</p>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)] text-xs">Last synced</span>
                <p className="text-xs mt-0.5">
                  {integration.last_synced_at
                    ? new Date(integration.last_synced_at).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)] text-xs">Connected since</span>
                <p className="text-xs mt-0.5">
                  {new Date(integration.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Last sync result */}
          {lastResult && (
            <div className={`rounded-lg p-3 text-xs ${
              lastResult.errors.length > 0
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {lastResult.errors.length > 0
                  ? <AlertCircle size={14} className="text-amber-600" />
                  : <CheckCircle2 size={14} className="text-green-600" />}
                <span className="font-semibold">Sync complete</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <span className="text-[var(--text-tertiary)]">Invoices</span>
                  <p className="font-semibold">{lastResult.invoices_synced}</p>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">Expenses</span>
                  <p className="font-semibold">{lastResult.expenses_synced}</p>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">Payments</span>
                  <p className="font-semibold">{lastResult.payments_pulled}</p>
                </div>
              </div>
              {lastResult.errors.length > 0 && (
                <div className="space-y-1 text-amber-800">
                  {lastResult.errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--navy)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {syncing
                    ? <Loader2 size={14} className="animate-spin" />
                    : <RefreshCw size={14} />}
                  {syncing ? 'Syncing...' : 'Sync now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {disconnecting
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Unplug size={14} />}
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2CA01C] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {connecting
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Plug size={14} />}
                {connecting ? 'Redirecting...' : 'Connect to QuickBooks'}
              </button>
            )}
          </div>
        </div>

        {/* Sync description */}
        <div className="px-5 py-3 bg-[var(--bg)] border-t border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-tertiary)]">
            Pushes unsynced invoices and expenses to QBO. Pulls payments to mark invoices paid.
            Auto-syncs daily at 6:00 AM Eastern.
          </p>
        </div>
      </div>

      {/* Gusto Payroll Card */}
      <div className="bg-white rounded-xl border border-[var(--border-light)] px-5 py-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-green-600">G</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-[var(--text)]">Gusto Payroll</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Sync employees and pay periods. Gusto handles tax calculations, direct deposits, and compliance.
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Connect via the Gusto OAuth flow, then use "Send to Gusto" on the Pay Period detail page.
            </p>
            <div className="mt-3">
              {gustoIntegration ? (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]">
                    <CheckCircle2 size={13} />
                    Connected
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    {gustoIntegration.last_synced_at
                      ? `Last sync: ${new Date(gustoIntegration.last_synced_at).toLocaleString()}`
                      : 'Never synced'}
                  </span>
                  <button
                    className="text-[11px] font-semibold text-[var(--danger)] ml-auto"
                    onClick={async () => {
                      await supabase.from('integrations').update({ is_active: false }).eq('id', gustoIntegration.id)
                      loadIntegration()
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--navy)] text-white"
                  onClick={async () => {
                    try {
                      const { data } = await supabase.functions.invoke('gusto-auth', {
                        body: { action: 'connect' },
                      })
                      if (data?.url) window.open(data.url, '_blank')
                    } catch (err) {
                      console.error('Gusto connect error', err)
                    }
                  }}
                >
                  <Plug size={13} />
                  Connect Gusto
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Future integrations placeholder */}
      <div className="space-y-3">
        {['Stripe Payments', 'Twilio SMS'].map((name) => (
          <div
            key={name}
            className="bg-white rounded-xl border border-[var(--border-light)] px-5 py-4 flex items-center gap-4 opacity-60"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Plug size={17} className="text-gray-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-[var(--text)]">{name}</h3>
              <p className="text-xs text-[var(--text-tertiary)]">Coming soon</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
