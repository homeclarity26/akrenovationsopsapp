// EmployeeHomeRouter — picks chat-first AssistantHome vs the legacy tile grid
// based on the per-user feature flag profiles.ai_v2_enabled. Phase 1 default
// is false; Adam flips his own account on first.

import { useAuth } from '@/context/AuthContext'
import { AssistantHome } from '@/components/assistant/AssistantHome'
import { EmployeeHome } from '@/pages/employee/EmployeeHome'

export function EmployeeHomeRouter() {
  const { user } = useAuth()
  if (user?.ai_v2_enabled) return <AssistantHome />
  return <EmployeeHome />
}
