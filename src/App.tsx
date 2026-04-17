import { lazy, Suspense, useState, useEffect } from 'react'
import * as Sentry from '@sentry/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ModeProvider } from '@/context/ModeContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ToastProvider } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

// Layouts — lazy-loaded so only the layout for the user's role is fetched
const AdminLayout = lazy(() => import('./components/layout/AdminLayout').then(m => ({ default: m.AdminLayout })))
const EmployeeLayout = lazy(() => import('./components/layout/EmployeeLayout').then(m => ({ default: m.EmployeeLayout })))
const ClientLayout = lazy(() => import('./components/layout/ClientLayout').then(m => ({ default: m.ClientLayout })))
const PlatformLayout = lazy(() => import('./components/layout/PlatformLayout').then(m => ({ default: m.PlatformLayout })))

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const CRMPage = lazy(() => import('./pages/admin/CRMPage').then(m => ({ default: m.CRMPage })))
const ProjectsPage = lazy(() => import('./pages/admin/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const ProjectDetailPage = lazy(() => import('./pages/admin/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })))
const FinancialsPage = lazy(() => import('./pages/admin/FinancialsPage').then(m => ({ default: m.FinancialsPage })))
const SchedulePage = lazy(() => import('./pages/admin/SchedulePage').then(m => ({ default: m.SchedulePage })))
const InvoicesPage = lazy(() => import('./pages/admin/InvoicesPage').then(m => ({ default: m.InvoicesPage })))
const ProposalsPage = lazy(() => import('./pages/admin/ProposalsPage').then(m => ({ default: m.ProposalsPage })))
const WalkthroughPage = lazy(() => import('./pages/admin/WalkthroughPage').then(m => ({ default: m.WalkthroughPage })))
const AdminInventoryPage = lazy(() => import('./pages/admin/AdminInventoryPage').then(m => ({ default: m.AdminInventoryPage })))
const SubcontractorsPage = lazy(() => import('./pages/admin/SubcontractorsPage').then(m => ({ default: m.SubcontractorsPage })))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })))
const SettingsLayout = lazy(() => import('./pages/admin/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })))
const MemoryInspectorPage = lazy(() => import('./pages/admin/settings/MemoryInspectorPage').then(m => ({ default: m.MemoryInspectorPage })))
const AgentsPage = lazy(() => import('./pages/admin/settings/AgentsPage').then(m => ({ default: m.AgentsPage })))
const ApprovalsPage = lazy(() => import('./pages/admin/settings/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })))
const MetaAgentPage = lazy(() => import('./pages/admin/MetaAgentPage').then(m => ({ default: m.MetaAgentPage })))
const ImprovementQueuePage = lazy(() => import('./pages/admin/ImprovementQueuePage').then(m => ({ default: m.ImprovementQueuePage })))
const FieldLaunchpadPage = lazy(() => import('./pages/admin/FieldLaunchpadPage').then(m => ({ default: m.FieldLaunchpadPage })))
const PendingTimeEntriesPage = lazy(() => import('./pages/admin/time/PendingTimeEntriesPage').then(m => ({ default: m.PendingTimeEntriesPage })))
const WorkTypeRatesPage = lazy(() => import('./pages/admin/settings/WorkTypeRatesPage').then(m => ({ default: m.WorkTypeRatesPage })))
const CompliancePage = lazy(() => import('./pages/admin/CompliancePage').then(m => ({ default: m.CompliancePage })))
const ScopeDetailPage = lazy(() => import('./pages/admin/ScopeDetailPage').then(m => ({ default: m.ScopeDetailPage })))
const SubContractPage = lazy(() => import('./pages/admin/SubContractPage').then(m => ({ default: m.SubContractPage })))
const PayrollDashboardPage = lazy(() => import('./pages/admin/payroll/PayrollDashboardPage').then(m => ({ default: m.PayrollDashboardPage })))
const PayPeriodDetailPage = lazy(() => import('./pages/admin/payroll/PayPeriodDetailPage').then(m => ({ default: m.PayPeriodDetailPage })))
const PayrollWorkersPage = lazy(() => import('./pages/admin/payroll/PayrollWorkersPage').then(m => ({ default: m.PayrollWorkersPage })))
const WorkerSetupPage = lazy(() => import('./pages/admin/payroll/WorkerSetupPage').then(m => ({ default: m.WorkerSetupPage })))
const NewWorkerPage = lazy(() => import('./pages/admin/payroll/WorkerSetupPage').then(m => ({ default: m.NewWorkerPage })))
const PayrollHistoryPage = lazy(() => import('./pages/admin/payroll/PayrollHistoryPage').then(m => ({ default: m.PayrollHistoryPage })))
const PayrollReportsPage = lazy(() => import('./pages/admin/payroll/PayrollReportsPage').then(m => ({ default: m.PayrollReportsPage })))
// Phase J
const ChecklistsPage = lazy(() => import('./pages/admin/ChecklistsPage').then(m => ({ default: m.ChecklistsPage })))
const EstimateTemplatesPage = lazy(() => import('./pages/admin/settings/EstimateTemplatesPage').then(m => ({ default: m.EstimateTemplatesPage })))
const ChecklistTemplatesPage = lazy(() => import('./pages/admin/settings/ChecklistTemplatesPage').then(m => ({ default: m.ChecklistTemplatesPage })))
// Phase K
const PortfolioPage = lazy(() => import('./pages/admin/portfolio/PortfolioPage').then(m => ({ default: m.PortfolioPage })))
const WarrantyPage = lazy(() => import('./pages/admin/warranty/WarrantyPage').then(m => ({ default: m.WarrantyPage })))
const MaterialsPage = lazy(() => import('./pages/admin/settings/MaterialsPage').then(m => ({ default: m.MaterialsPage })))
const ToolRequestsAdminPage = lazy(() => import('./pages/admin/settings/ToolRequestsPage').then(m => ({ default: m.ToolRequestsAdminPage })))
// Phase N
const TemplatesPage = lazy(() => import('./pages/admin/settings/TemplatesPage').then(m => ({ default: m.TemplatesPage })))
// Phase M
const BackupsPage = lazy(() => import('./pages/admin/settings/BackupsPage').then(m => ({ default: m.BackupsPage })))
const SecurityPage = lazy(() => import('./pages/admin/settings/SecurityPage').then(m => ({ default: m.SecurityPage })))
const BusinessContextPage = lazy(() => import('./pages/admin/settings/BusinessContextPage').then(m => ({ default: m.BusinessContextPage })))
// Phase O
const HealthPage = lazy(() => import('./pages/admin/settings/HealthPage').then(m => ({ default: m.HealthPage })))
// Wave D — QuickBooks + Gusto
const IntegrationsPage = lazy(() => import('./pages/admin/settings/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })))
const BrandingPage = lazy(() => import('./pages/admin/settings/BrandingPage').then(m => ({ default: m.BrandingPage })))
const NotificationsPage = lazy(() => import('./pages/admin/settings/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const RemindersPage = lazy(() => import('./pages/RemindersPage').then(m => ({ default: m.RemindersPage })))
const OnboardingPage = lazy(() => import('./pages/admin/OnboardingPage').then(m => ({ default: m.OnboardingPage })))
const CompanyOnboardingWizard = lazy(() => import('./pages/onboarding/CompanyOnboardingWizard').then(m => ({ default: m.CompanyOnboardingWizard })))
const PlatformOnboarding = lazy(() => import('./pages/onboarding/PlatformOnboarding').then(m => ({ default: m.PlatformOnboarding })))
const FieldOnboarding = lazy(() => import('./pages/onboarding/FieldOnboarding').then(m => ({ default: m.FieldOnboarding })))

// Employee pages
const EmployeeHome = lazy(() => import('./pages/employee/EmployeeHome').then(m => ({ default: m.EmployeeHome })))
const TimeClockPage = lazy(() => import('./pages/employee/TimeClockPage').then(m => ({ default: m.TimeClockPage })))
const ShoppingListPage = lazy(() => import('./pages/employee/ShoppingListPage').then(m => ({ default: m.ShoppingListPage })))
const SchedulePageEmployee = lazy(() => import('./pages/employee/SchedulePageEmployee').then(m => ({ default: m.SchedulePageEmployee })))
const MessagesPage = lazy(() => import('./pages/employee/MessagesPage').then(m => ({ default: m.MessagesPage })))
const ReceiptsPage = lazy(() => import('./pages/employee/ReceiptsPage').then(m => ({ default: m.ReceiptsPage })))
const PhotosPage = lazy(() => import('./pages/employee/PhotosPage').then(m => ({ default: m.PhotosPage })))
const BonusTrackerPage = lazy(() => import('./pages/employee/BonusTrackerPage').then(m => ({ default: m.BonusTrackerPage })))
const NotesPage = lazy(() => import('./pages/employee/NotesPage').then(m => ({ default: m.NotesPage })))
const ClientInfoPage = lazy(() => import('./pages/employee/ClientInfoPage').then(m => ({ default: m.ClientInfoPage })))
const PaystubsPage = lazy(() => import('./pages/employee/PaystubsPage').then(m => ({ default: m.PaystubsPage })))
const EmployeeChecklistsPage = lazy(() => import('./pages/employee/EmployeeChecklistsPage').then(m => ({ default: m.EmployeeChecklistsPage })))
const ToolRequestPage = lazy(() => import('./pages/employee/ToolRequestPage').then(m => ({ default: m.ToolRequestPage })))
const EmployeeProjectsPage = lazy(() => import('./pages/employee/EmployeeProjectsPage').then(m => ({ default: m.EmployeeProjectsPage })))
const EmployeeProjectDetailPage = lazy(() => import('./pages/employee/EmployeeProjectDetailPage').then(m => ({ default: m.EmployeeProjectDetailPage })))
// PR 9 — employee stocktake flow
const EmployeeStocktakePage = lazy(() => import('./pages/employee/EmployeeStocktakePage').then(m => ({ default: m.EmployeeStocktakePage })))

// Client pages
const ClientProgress = lazy(() => import('./pages/client/ClientProgress').then(m => ({ default: m.ClientProgress })))
const ClientPhotos = lazy(() => import('./pages/client/ClientPhotos').then(m => ({ default: m.ClientPhotos })))
const ClientInvoices = lazy(() => import('./pages/client/ClientInvoices').then(m => ({ default: m.ClientInvoices })))
const ClientMessages = lazy(() => import('./pages/client/ClientMessages').then(m => ({ default: m.ClientMessages })))
const ClientDocs = lazy(() => import('./pages/client/ClientDocs').then(m => ({ default: m.ClientDocs })))
const ClientSelections = lazy(() => import('./pages/client/ClientSelections').then(m => ({ default: m.ClientSelections })))
const ClientPunchList = lazy(() => import('./pages/client/ClientPunchList').then(m => ({ default: m.ClientPunchList })))
const ClientSchedule = lazy(() => import('./pages/client/ClientSchedule').then(m => ({ default: m.ClientSchedule })))
const ClientReferral = lazy(() => import('./pages/client/ClientReferral').then(m => ({ default: m.ClientReferral })))
// Client onboarding (public — user creates account during wizard)
const ClientOnboardingWizard = lazy(() => import('./pages/onboarding/ClientOnboardingWizard').then(m => ({ default: m.ClientOnboardingWizard })))

// Public gallery (no auth)
const PublicGallery = lazy(() => import('./pages/public/PublicGallery').then(m => ({ default: m.PublicGallery })))
// Public demos (no auth, no Supabase)
const EmployeeDemoShell = lazy(() => import('./demo/employee/EmployeeDemoShell'))
const HomeownerDemoShell = lazy(() => import('./demo/homeowner/HomeownerDemoShell'))

// Platform admin pages
const PlatformDashboard = lazy(() => import('./pages/platform/PlatformDashboard').then(m => ({ default: m.PlatformDashboard })))
const PlatformCompanies = lazy(() => import('./pages/platform/PlatformCompanies').then(m => ({ default: m.PlatformCompanies })))
const PlatformCompanyDetail = lazy(() => import('./pages/platform/PlatformCompanyDetail').then(m => ({ default: m.PlatformCompanyDetail })))
const PlatformUsers = lazy(() => import('./pages/platform/PlatformUsers').then(m => ({ default: m.PlatformUsers })))

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function AuthLoadingScreen() {
  return (
    <div
      className="min-h-svh flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{
          borderColor: 'var(--border)',
          borderTopColor: 'var(--rust)',
        }}
      />
    </div>
  )
}

/** Requires authentication but no specific role — used for onboarding wizards accessible by any role. */
function AuthRequired({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ProtectedRoute({ role, children }: { role: 'admin' | 'employee' | 'client' | 'super_admin'; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  // Wait for the initial Supabase session check to complete before deciding
  // where to send the user. Without this, a page refresh redirects to /login
  // before the session restores.
  if (loading) return <AuthLoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  // Super-admins can access any area — platform admin, company admin, field
  // mode (for previewing employee screens), client portal (for previewing
  // what clients see). Previously they were blocked from /employee, which
  // silently broke the Admin/Field ModeToggle.
  if (user.role === 'super_admin') return <>{children}</>
  // Admins can access all routes (field mode lets admins use employee screens)
  if (user.role === 'admin') return <>{children}</>
  if (user.role !== role) {
    if (user.role === 'employee') return <Navigate to="/employee" replace />
    return <Navigate to="/client/progress" replace />
  }
  return <>{children}</>
}

function RootRedirect() {
  const { user, loading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [needsCompanyOnboarding, setNeedsCompanyOnboarding] = useState(false)

  useEffect(() => {
    if (loading || !user) {
      setChecking(false)
      return
    }
    // Only check company onboarding for admin role (super_admin uses profile flags)
    if (user.role !== 'admin') {
      setChecking(false)
      return
    }
    async function check() {
      try {
        if (!user!.company_id) {
          setNeedsCompanyOnboarding(true)
          setChecking(false)
          return
        }
        const { data: company } = await supabase
          .from('companies')
          .select('onboarding_complete')
          .eq('id', user!.company_id)
          .maybeSingle()
        if (!company || company.onboarding_complete === false) {
          setNeedsCompanyOnboarding(true)
        }
      } catch {
        // On error, skip onboarding check and let them through
      }
      setChecking(false)
    }
    check()
  }, [user, loading])

  if (loading || checking) return <AuthLoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  // 3-level onboarding routing
  // Level 1: Platform admin onboarding (super_admin only)
  if (user.role === 'super_admin' && !user.platform_onboarding_complete) {
    return <Navigate to="/onboard/platform" replace />
  }

  // Level 2: Company/business admin onboarding (admin + super_admin)
  if (user.role === 'super_admin' && !user.company_onboarding_complete) {
    return <Navigate to="/onboard/company" replace />
  }
  if (user.role === 'admin' && (needsCompanyOnboarding || !user.company_onboarding_complete)) {
    return <Navigate to="/onboard/company" replace />
  }

  // Level 3: Field mode onboarding (employees, or admin/super_admin who haven't done it)
  if (user.role === 'employee' && !user.field_onboarding_complete) {
    return <Navigate to="/onboard/field" replace />
  }

  // Normal routing
  if (user.role === 'super_admin') return <Navigate to="/admin" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'employee') return <Navigate to="/employee" replace />
  return <Navigate to="/client/progress" replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Onboarding wizards (standalone, no layout chrome) */}
        <Route path="/onboard/platform" element={<ProtectedRoute role="super_admin"><PlatformOnboarding /></ProtectedRoute>} />
        <Route path="/onboard/company" element={<ProtectedRoute role="admin"><CompanyOnboardingWizard /></ProtectedRoute>} />
        <Route path="/onboard/field" element={<AuthRequired><FieldOnboarding /></AuthRequired>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="crm" element={<CRMPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="projects/:id/subs/:subId/scope" element={<ScopeDetailPage />} />
          <Route path="projects/:id/subs/:subId/contract" element={<SubContractPage />} />
          <Route path="compliance" element={<CompliancePage />} />
          <Route path="financials" element={<FinancialsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="proposals" element={<ProposalsPage />} />
          <Route path="walkthrough" element={<WalkthroughPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="subs" element={<SubcontractorsPage />} />
          <Route path="ai" element={<MetaAgentPage />} />
          {/* Settings — nested under SettingsLayout with sidebar/tabs */}
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<SettingsPage />} />
            <Route path="context" element={<BusinessContextPage />} />
            <Route path="branding" element={<BrandingPage />} />
            <Route path="rates" element={<WorkTypeRatesPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="estimate-templates" element={<EstimateTemplatesPage />} />
            <Route path="checklists" element={<ChecklistTemplatesPage />} />
            <Route path="materials" element={<MaterialsPage />} />
            <Route path="tool-requests" element={<ToolRequestsAdminPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="memory" element={<MemoryInspectorPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="backups" element={<BackupsPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="ai/improvements" element={<ImprovementQueuePage />} />
          <Route path="field" element={<FieldLaunchpadPage />} />
          <Route path="time" element={<TimeClockPage />} />
          <Route path="time/pending" element={<PendingTimeEntriesPage />} />
          {/* Payroll (Phase I) */}
          <Route path="payroll" element={<PayrollDashboardPage />} />
          <Route path="payroll/workers" element={<PayrollWorkersPage />} />
          <Route path="payroll/workers/new" element={<NewWorkerPage />} />
          <Route path="payroll/workers/:workerId" element={<WorkerSetupPage />} />
          <Route path="payroll/history" element={<PayrollHistoryPage />} />
          <Route path="payroll/reports" element={<PayrollReportsPage />} />
          <Route path="payroll/:periodId" element={<PayPeriodDetailPage />} />
          {/* Phase J — Checklists & Estimate Templates */}
          <Route path="checklists" element={<ChecklistsPage />} />
          {/* Phase K — sub-routes (no new top-level nav) */}
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="warranty" element={<WarrantyPage />} />
          <Route path="onboard" element={<OnboardingPage />} />
        </Route>

        {/* Employee */}
        <Route path="/employee" element={<ProtectedRoute role="employee"><EmployeeLayout /></ProtectedRoute>}>
          <Route index element={<EmployeeHome />} />
          <Route path="time" element={<TimeClockPage />} />
          <Route path="shopping" element={<ShoppingListPage />} />
          <Route path="schedule" element={<SchedulePageEmployee />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="bonus" element={<BonusTrackerPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="client-info" element={<ClientInfoPage />} />
          <Route path="paystubs" element={<PaystubsPage />} />
          <Route path="checklists" element={<EmployeeChecklistsPage />} />
          {/* Phase K — sub-route */}
          <Route path="tool-request" element={<ToolRequestPage />} />
          {/* PR 5 — field-mode project detail */}
          <Route path="projects" element={<EmployeeProjectsPage />} />
          <Route path="projects/:id" element={<EmployeeProjectDetailPage />} />
          {/* PR 9 — employee stocktake */}
          <Route path="stocktake" element={<EmployeeStocktakePage />} />
          <Route path="reminders" element={<RemindersPage />} />
        </Route>

        {/* Client */}
        <Route path="/client" element={<ProtectedRoute role="client"><ClientLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/client/progress" replace />} />
          <Route path="progress" element={<ClientProgress />} />
          <Route path="photos" element={<ClientPhotos />} />
          <Route path="selections" element={<ClientSelections />} />
          <Route path="invoices" element={<ClientInvoices />} />
          <Route path="messages" element={<ClientMessages />} />
          <Route path="schedule" element={<ClientSchedule />} />
          <Route path="punch" element={<ClientPunchList />} />
          <Route path="docs" element={<ClientDocs />} />
          {/* Phase K — client sub-route */}
          <Route path="referral" element={<ClientReferral />} />
        </Route>

        {/* Platform Admin (super_admin) */}
        <Route path="/platform" element={<ProtectedRoute role="super_admin"><PlatformLayout /></ProtectedRoute>}>
          <Route index element={<PlatformDashboard />} />
          <Route path="companies" element={<PlatformCompanies />} />
          <Route path="companies/:id" element={<PlatformCompanyDetail />} />
          <Route path="users" element={<PlatformUsers />} />
        </Route>

        {/* Client onboarding wizard (public — account is created during flow) */}
        <Route path="/welcome" element={<ClientOnboardingWizard />} />
        <Route path="/onboard/client" element={<ClientOnboardingWizard />} />

        {/* Phase K — public shareable gallery (no auth) */}
        <Route path="/gallery/:token" element={<PublicGallery />} />

        {/* Phase L — public demos (no auth, no Supabase) */}
        <Route path="/demo" element={<Navigate to="/demo/employee" replace />} />
        <Route path="/demo/employee" element={<EmployeeDemoShell />} />
        <Route path="/experience" element={<HomeownerDemoShell />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ThemeProvider>
        <BrowserRouter>
          <ModeProvider>
            <Sentry.ErrorBoundary
              fallback={({ error, componentStack }) => {
                // Diagnostic fallback — renders the real error message,
                // component stack, and JS stack with a one-tap copy button.
                // Replaces the bland "Something went wrong" splash so that
                // when a user screenshots the error they can paste the
                // actual diagnostic info to whoever's fixing the bug.
                const err = error as Error
                const name = err?.name ?? 'Error'
                const message = err?.message ?? String(err ?? 'Unknown error')
                const stack = err?.stack ?? ''
                const payload = [
                  `${name}: ${message}`,
                  '',
                  '--- component stack ---',
                  String(componentStack ?? '(none)'),
                  '',
                  '--- js stack ---',
                  stack,
                  '',
                  `url: ${typeof window !== 'undefined' ? window.location.href : ''}`,
                  `ua:  ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
                ].join('\n')
                const copy = () => {
                  try {
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(payload)
                    } else {
                      const ta = document.createElement('textarea')
                      ta.value = payload
                      document.body.appendChild(ta)
                      ta.select()
                      document.execCommand('copy')
                      ta.remove()
                    }
                    // eslint-disable-next-line no-alert
                    alert('Error details copied. Paste them to your developer.')
                  } catch {
                    // ignore — user can still long-press to select the block below
                  }
                }
                return (
                  <div style={{ padding: '1rem', fontFamily: 'system-ui,-apple-system,sans-serif', maxWidth: 640, margin: '0 auto' }}>
                    <h2 style={{ margin: '0 0 8px', color: '#b91c1c' }}>Something went wrong</h2>
                    <p style={{ margin: '0 0 16px', color: '#444', fontSize: 14 }}>
                      Tap <b>Copy details</b> and paste them in chat so the bug can be fixed.
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      <button
                        onClick={copy}
                        style={{ padding: '10px 14px', background: '#1e3a5f', color: '#fff', border: 0, borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                      >
                        Copy details
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        style={{ padding: '10px 14px', background: '#fff', color: '#1e3a5f', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                      >
                        Refresh
                      </button>
                      <button
                        onClick={() => { window.location.href = '/login' }}
                        style={{ padding: '10px 14px', background: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
                      >
                        Go to login
                      </button>
                    </div>
                    <div style={{ background: '#fee', border: '1px solid #fcc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: 4 }}>{name}</div>
                      <div style={{ fontSize: 13, color: '#333', wordBreak: 'break-word' }}>{message}</div>
                    </div>
                    <details style={{ fontSize: 11, color: '#555' }}>
                      <summary style={{ cursor: 'pointer', userSelect: 'none' }}>Show full diagnostic info</summary>
                      <pre
                        style={{
                          marginTop: 8,
                          padding: 10,
                          background: '#f6f6f6',
                          border: '1px solid #eee',
                          borderRadius: 6,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '60vh',
                          overflow: 'auto',
                          userSelect: 'text',
                        }}
                      >
                        {payload}
                      </pre>
                    </details>
                  </div>
                )
              }}
            >
              <AppRoutes />
              <ToastProvider />
            </Sentry.ErrorBoundary>
          </ModeProvider>
        </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
