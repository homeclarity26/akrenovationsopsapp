import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type UsageRange = 'today' | '7d' | '30d' | 'mtd'

export interface UsageStats {
  total_cost: number
  range: string
  by_service: Record<string, { total_cost: number; calls: number; input_tokens: number; output_tokens: number }>
  top_agents: Array<{ name: string; service: string; total_cost: number; calls: number; input_tokens: number; output_tokens: number }>
  by_day: Record<string, number>
  total_calls: number
}

export function useApiUsage(range: UsageRange = 'today') {
  return useQuery<UsageStats>({
    queryKey: ['api-usage', range],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-usage-stats', {
        body: { range },
      })
      if (error) throw error
      return data
    },
    refetchInterval: 60_000, // refresh every 60 seconds
    staleTime: 30_000,
  })
}
