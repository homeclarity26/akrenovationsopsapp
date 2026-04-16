import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FolderOpen, MapPin, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { SkeletonCard } from '@/components/ui/Skeleton'

interface ProjectRow {
  id: string
  title: string
  client_name: string | null
  address: string | null
  status: string | null
  schedule_status: string | null
  percent_complete: number | null
}

/**
 * Employee-facing list of projects the user is assigned to. RLS — via the
 * `can_access_project` helper added in PR 1 — ensures this `select *` only
 * returns rows the caller can see. No client-side filtering needed.
 */
export function EmployeeProjectsPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  const { data: projects = [], isLoading, error, refetch } = useQuery<ProjectRow[]>({
    queryKey: ['employee-projects', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error: supaError } = await supabase
        .from('projects')
        .select('id, title, client_name, address, status, schedule_status, percent_complete')
        .order('created_at', { ascending: false })
      if (supaError) throw supaError
      return (data ?? []) as ProjectRow[]
    },
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(p =>
      (p.title?.toLowerCase().includes(q)) ||
      (p.client_name?.toLowerCase().includes(q)) ||
      (p.address?.toLowerCase().includes(q))
    )
  }, [projects, search])

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <PageHeader title="Projects" subtitle="Jobs assigned to you" />

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-full h-10 pl-9 pr-3 bg-white border border-[var(--border-light)] rounded-xl text-sm focus:outline-none focus:border-[var(--navy)]"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <Card>
          <p className="text-sm text-[var(--text-secondary)] mb-3 text-center">
            Couldn't load your projects.
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => refetch()}
              className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg"
            >
              Retry
            </button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <FolderOpen size={28} className="text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              {projects.length === 0
                ? "You're not assigned to any projects yet. Once an admin adds you, they'll appear here."
                : 'No projects match that search.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Link key={p.id} to={`/employee/projects/${p.id}`} className="block">
              <Card className="flex items-center gap-3 hover:border-[var(--navy)] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{p.title}</p>
                  {p.client_name && (
                    <p className="text-xs text-[var(--text-secondary)] truncate">{p.client_name}</p>
                  )}
                  {p.address && (
                    <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5 truncate">
                      <MapPin size={11} className="flex-shrink-0" />
                      {p.address}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {p.status && <StatusPill status={p.status} />}
                    {p.schedule_status && <StatusPill status={p.schedule_status} />}
                    {typeof p.percent_complete === 'number' && p.status === 'active' && (
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                        {p.percent_complete}%
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
