import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'

// Layouts
import { AdminLayout } from '@/components/layout/AdminLayout'
import { EmployeeLayout } from '@/components/layout/EmployeeLayout'
import { ClientLayout } from '@/components/layout/ClientLayout'

// Auth
import { LoginPage } from '@/pages/auth/LoginPage'

// Admin pages
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { CRMPage } from '@/pages/admin/CRMPage'
import { ProjectsPage } from '@/pages/admin/ProjectsPage'
import { ProjectDetailPage } from '@/pages/admin/ProjectDetailPage'
import { FinancialsPage } from '@/pages/admin/FinancialsPage'
import { SchedulePage } from '@/pages/admin/SchedulePage'
import { InvoicesPage } from '@/pages/admin/InvoicesPage'
import { ProposalsPage } from '@/pages/admin/ProposalsPage'
import { WalkthroughPage } from '@/pages/admin/WalkthroughPage'
import { SubcontractorsPage } from '@/pages/admin/SubcontractorsPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { MemoryInspectorPage } from '@/pages/admin/settings/MemoryInspectorPage'
import { AgentsPage } from '@/pages/admin/settings/AgentsPage'
import { ApprovalsPage } from '@/pages/admin/settings/ApprovalsPage'
import { MetaAgentPage } from '@/pages/admin/MetaAgentPage'
import { ImprovementQueuePage } from '@/pages/admin/ImprovementQueuePage'
import { FieldLaunchpadPage } from '@/pages/admin/FieldLaunchpadPage'
import { PendingTimeEntriesPage } from '@/pages/admin/time/PendingTimeEntriesPage'
import { WorkTypeRatesPage } from '@/pages/admin/settings/WorkTypeRatesPage'
import { CompliancePage } from '@/pages/admin/CompliancePage'
import { ScopeDetailPage } from '@/pages/admin/ScopeDetailPage'
import { SubContractPage } from '@/pages/admin/SubContractPage'
import { PayrollDashboardPage } from '@/pages/admin/payroll/PayrollDashboardPage'
import { PayPeriodDetailPage } from '@/pages/admin/payroll/PayPeriodDetailPage'
import { PayrollWorkersPage } from '@/pages/admin/payroll/PayrollWorkersPage'
import { WorkerSetupPage, NewWorkerPage } from '@/pages/admin/payroll/WorkerSetupPage'
import { PayrollHistoryPage } from '@/pages/admin/payroll/PayrollHistoryPage'
import { PayrollReportsPage } from '@/pages/admin/payroll/PayrollReportsPage'
// Phase J
import { ChecklistsPage } from '@/pages/admin/ChecklistsPage'
import { EstimateTemplatesPage } from '@/pages/admin/settings/EstimateTemplatesPage'
import { ChecklistTemplatesPage } from '@/pages/admin/settings/ChecklistTemplatesPage'
// Phase K — sub-routes only
import { PortfolioPage } from '@/pages/admin/portfolio/PortfolioPage'
import { WarrantyPage } from '@/pages/admin/warranty/WarrantyPage'
import { MaterialsPage } from '@/pages/admin/settings/MaterialsPage'
import { ToolRequestsAdminPage } from '@/pages/admin/settings/ToolRequestsPage'

// Employee pages
import { EmployeeHome } from '@/pages/employee/EmployeeHome'
import { TimeClockPage } from '@/pages/employee/TimeClockPage'
import { ShoppingListPage } from '@/pages/employee/ShoppingListPage'
import { SchedulePageEmployee } from '@/pages/employee/SchedulePageEmployee'
import { MessagesPage } from '@/pages/employee/MessagesPage'
import { ReceiptsPage } from '@/pages/employee/ReceiptsPage'
import { PhotosPage } from '@/pages/employee/PhotosPage'
import { BonusTrackerPage } from '@/pages/employee/BonusTrackerPage'
import { NotesPage } from '@/pages/employee/NotesPage'
import { ClientInfoPage } from '@/pages/employee/ClientInfoPage'
import { PaystubsPage } from '@/pages/employee/PaystubsPage'
import { EmployeeChecklistsPage } from '@/pages/employee/EmployeeChecklistsPage'
// Phase K — employee sub-routes
import { ToolRequestPage } from '@/pages/employee/ToolRequestPage'

// Client pages
import { ClientProgress } from '@/pages/client/ClientProgress'
import { ClientPhotos } from '@/pages/client/ClientPhotos'
import { ClientInvoices } from '@/pages/client/ClientInvoices'
import { ClientMessages } from '@/pages/client/ClientMessages'
import { ClientDocs } from '@/pages/client/ClientDocs'
import { ClientSelections } from '@/pages/client/ClientSelections'
import { ClientPunchList } from '@/pages/client/ClientPunchList'
import { ClientSchedule } from '@/pages/client/ClientSchedule'
// Phase K — client sub-route
import { ClientReferral } from '@/pages/client/ClientReferral'
// Phase K — public gallery (no auth)
import { PublicGallery } from '@/pages/public/PublicGallery'
// Phase L — public demo experiences (no auth, no Supabase)
import EmployeeDemoShell from '@/demo/employee/EmployeeDemoShell'
import HomeownerDemoShell from '@/demo/homeowner/HomeownerDemoShell'

const qc = new QueryClient()

function ProtectedRoute({ role, children }: { role: 'admin' | 'employee' | 'client'; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    if (user.role === 'employee') return <Navigate to="/employee" replace />
    return <Navigate to="/client/progress" replace />
  }
  return <>{children}</>
}

function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'employee') return <Navigate to="/employee" replace />
  return <Navigate to="/client/progress" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

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
        <Route path="subs" element={<SubcontractorsPage />} />
        <Route path="ai" element={<MetaAgentPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/memory" element={<MemoryInspectorPage />} />
        <Route path="settings/agents" element={<AgentsPage />} />
        <Route path="settings/approvals" element={<ApprovalsPage />} />
        <Route path="ai/improvements" element={<ImprovementQueuePage />} />
        <Route path="field" element={<FieldLaunchpadPage />} />
        <Route path="time" element={<TimeClockPage />} />
        <Route path="time/pending" element={<PendingTimeEntriesPage />} />
        <Route path="settings/rates" element={<WorkTypeRatesPage />} />
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
        <Route path="settings/estimate-templates" element={<EstimateTemplatesPage />} />
        <Route path="settings/checklists" element={<ChecklistTemplatesPage />} />
        {/* Phase K — sub-routes (no new top-level nav) */}
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="warranty" element={<WarrantyPage />} />
        <Route path="settings/materials" element={<MaterialsPage />} />
        <Route path="settings/tool-requests" element={<ToolRequestsAdminPage />} />
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

      {/* Phase K — public shareable gallery (no auth) */}
      <Route path="/gallery/:token" element={<PublicGallery />} />

      {/* Phase L — public demos (no auth, no Supabase) */}
      <Route path="/demo" element={<Navigate to="/demo/employee" replace />} />
      <Route path="/demo/employee" element={<EmployeeDemoShell />} />
      <Route path="/experience" element={<HomeownerDemoShell />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
