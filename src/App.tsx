// src/App.tsx
import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'
import { ADMIN_PANEL_ROLES, WORKSPACE_ROLES } from '@/lib/roles'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { HomePage } from '@/pages/HomePage'
import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { PasswordRecoveryRedirect } from '@/components/auth/PasswordRecoveryRedirect'
const AboutPage = lazy(() => import('@/pages/AboutPage').then(m => ({ default: m.AboutPage })))
const AnnualMeetingPage = lazy(() => import('@/pages/AnnualMeetingPage').then(m => ({ default: m.AnnualMeetingPage })))
const AdminClubPage = lazy(() => import('@/pages/AdminClubPage').then(m => ({ default: m.AdminClubPage })))
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })))
const BoardInboxPage = lazy(() => import('@/pages/BoardInboxPage').then(m => ({ default: m.BoardInboxPage })))
const BoardPage = lazy(() => import('@/pages/BoardPage').then(m => ({ default: m.BoardPage })))
const ChampionsPage = lazy(() => import('@/pages/ChampionsPage').then(m => ({ default: m.ChampionsPage })))
const BylawsPage = lazy(() => import('@/pages/BylawsPage').then(m => ({ default: m.BylawsPage })))
const ClubDetailPage = lazy(() => import('@/pages/ClubDetailPage').then(m => ({ default: m.ClubDetailPage })))
const ClubsPage = lazy(() => import('@/pages/ClubsPage').then(m => ({ default: m.ClubsPage })))
const ContactPage = lazy(() => import('@/pages/ContactPage').then(m => ({ default: m.ContactPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const AccountSecurityPage = lazy(() => import('@/pages/AccountSecurityPage').then(m => ({ default: m.AccountSecurityPage })))
const DonationSuccessPage = lazy(() => import('@/pages/DonationSuccessPage').then(m => ({ default: m.DonationSuccessPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const ManageClubPage = lazy(() => import('@/pages/ManageClubPage').then(m => ({ default: m.ManageClubPage })))
const MembershipPage = lazy(() => import('@/pages/MembershipPage').then(m => ({ default: m.MembershipPage })))
const MembershipSuccessPage = lazy(() => import('@/pages/MembershipSuccessPage').then(m => ({ default: m.MembershipSuccessPage })))
const MinutesPage = lazy(() => import('@/pages/MinutesPage').then(m => ({ default: m.MinutesPage })))
const NewsPage = lazy(() => import('@/pages/NewsPage').then(m => ({ default: m.NewsPage })))
const NewsPostPage = lazy(() => import('@/pages/NewsPostPage').then(m => ({ default: m.NewsPostPage })))
const ScannerPage = lazy(() => import('@/pages/ScannerPage').then(m => ({ default: m.ScannerPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const ScholasticPage = lazy(() => import('@/pages/ScholasticPage').then(m => ({ default: m.ScholasticPage })))
const SupportPage = lazy(() => import('@/pages/SupportPage').then(m => ({ default: m.SupportPage })))
const TournamentDetailPage = lazy(() => import('@/pages/TournamentDetailPage').then(m => ({ default: m.TournamentDetailPage })))
const TournamentManagePage = lazy(() => import('@/pages/TournamentManagePage').then(m => ({ default: m.TournamentManagePage })))
const TournamentPairingsPage = lazy(() => import('@/pages/TournamentPairingsPage').then(m => ({ default: m.TournamentPairingsPage })))
const TournamentPrintPage = lazy(() => import('@/pages/TournamentPrintPage').then(m => ({ default: m.TournamentPrintPage })))
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage').then(m => ({ default: m.WorkspacePage })))
const TournamentsPage = lazy(() => import('@/pages/TournamentsPage').then(m => ({ default: m.TournamentsPage })))
function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <PasswordRecoveryRedirect />
      <ImpersonationBanner />
      <AnnouncementBanner />
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 py-24 text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span className="text-sm">Loading…</span>
            </div>
          }
        >
          <Routes>
            {/* ── Public ── */}
            <Route path="/" element={<HomePage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            <Route path="/tournaments/:id/pairings" element={<TournamentPairingsPage />} />
            <Route path="/tournaments/:id/print" element={<TournamentPrintPage />} />
            <Route path="/scholastic" element={<ScholasticPage />} />
            <Route path="/clubs" element={<ClubsPage />} />
            <Route path="/clubs/:id" element={<ClubDetailPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:slug" element={<NewsPostPage />} />
            {/* Public on purpose: signed-out visitors see what it does and a
                prompt to log in. Scanning itself is members-only (the API
                checks), because each scan is a paid model call. */}
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/membership" element={<MembershipPage />} />
            <Route path="/membership/success" element={<MembershipSuccessPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/donate/success" element={<DonationSuccessPage />} />
            {/* ── Governance ── */}
            <Route path="/meeting" element={<AnnualMeetingPage />} />
            <Route path="/about" element={<AboutPage />} />
            {/* The old governance landing page is retired: the navbar opens on
                Board members, and GovLayout links to the rest from there. */}
            <Route path="/governance" element={<Navigate to="/governance/board" replace />} />
            <Route path="/governance/board" element={<BoardPage />} />
            <Route path="/champions" element={<ChampionsPage />} />
            <Route path="/state-champions" element={<Navigate to="/champions" replace />} />
            <Route path="/governance/bylaws" element={<BylawsPage />} />
            {/* RulesPage retired — its content merged into /governance/bylaws */}
            <Route path="/governance/rules" element={<Navigate to="/governance/bylaws" replace />} />
            <Route path="/governance/minutes" element={<MinutesPage />} />
            {/* ── Protected ── */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            {/* ProtectedRoute, not RoleProtectedRoute: an admin who has not
                enrolled yet must be able to reach the page that fixes that. */}
            <Route path="/account/security" element={<ProtectedRoute><AccountSecurityPage /></ProtectedRoute>} />
            <Route path="/manage/club" element={<RoleProtectedRoute roles={['club_rep']}><ManageClubPage /></RoleProtectedRoute>} />
            {/*
              ProtectedRoute, not RoleProtectedRoute: holding a board seat is an
              assignment, not a role, so there's no role value to gate on. The
              API enforces seat access and the page renders its own "no board
              inbox" state for signed-in members who hold none.
            */}
            <Route path="/board/inbox" element={<ProtectedRoute><BoardInboxPage /></ProtectedRoute>} />
            {/* ── Club reps, directors, auditors ── */}
            <Route path="/workspace" element={<RoleProtectedRoute roles={WORKSPACE_ROLES} allowDirectors><WorkspacePage /></RoleProtectedRoute>} />
            {/* ── Admin ── */}
            {/* Admin-only. Anyone else who follows an old /admin link lands in
                their workspace (or the dashboard) instead of an empty panel. */}
            <Route path="/admin" element={<RoleProtectedRoute roles={ADMIN_PANEL_ROLES} fallbackToToolsHome><AdminPage /></RoleProtectedRoute>} />
            <Route path="/admin/:section" element={<RoleProtectedRoute roles={ADMIN_PANEL_ROLES} fallbackToToolsHome><AdminPage /></RoleProtectedRoute>} />
            <Route path="/admin/clubs/:id" element={<RoleProtectedRoute requireClubMatch><AdminClubPage /></RoleProtectedRoute>} />
            <Route path="/admin/tournaments/:id" element={<RoleProtectedRoute roles={['lca_admin', 'lca_observer', 'club_rep', 'tournament_director']} allowDirectors requireTournamentAccess><TournamentManagePage /></RoleProtectedRoute>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
export default App