// src/App.tsx
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { HomePage } from '@/pages/HomePage'
import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { PasswordRecoveryRedirect } from '@/components/auth/PasswordRecoveryRedirect'
const AboutPage = lazy(() => import('@/pages/AboutPage').then(m => ({ default: m.AboutPage })))
const AdminClubPage = lazy(() => import('@/pages/AdminClubPage').then(m => ({ default: m.AdminClubPage })))
const AdminEmailPage = lazy(() => import('@/pages/AdminEmailPage').then(m => ({ default: m.AdminEmailPage })))
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })))
const AdminSupportPage = lazy(() => import('@/pages/AdminSupportPage').then(m => ({ default: m.AdminSupportPage })))
const BoardInboxPage = lazy(() => import('@/pages/BoardInboxPage').then(m => ({ default: m.BoardInboxPage })))
const BoardPage = lazy(() => import('@/pages/BoardPage').then(m => ({ default: m.BoardPage })))
const BylawsPage = lazy(() => import('@/pages/BylawsPage').then(m => ({ default: m.BylawsPage })))
const ClubDetailPage = lazy(() => import('@/pages/ClubDetailPage').then(m => ({ default: m.ClubDetailPage })))
const ClubsPage = lazy(() => import('@/pages/ClubsPage').then(m => ({ default: m.ClubsPage })))
const ContactPage = lazy(() => import('@/pages/ContactPage').then(m => ({ default: m.ContactPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const AccountSecurityPage = lazy(() => import('@/pages/AccountSecurityPage').then(m => ({ default: m.AccountSecurityPage })))
const DonationSuccessPage = lazy(() => import('@/pages/DonationSuccessPage').then(m => ({ default: m.DonationSuccessPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const GovernancePage = lazy(() => import('@/pages/GovernancePage').then(m => ({ default: m.GovernancePage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const ManageClubPage = lazy(() => import('@/pages/ManageClubPage').then(m => ({ default: m.ManageClubPage })))
const MembershipPage = lazy(() => import('@/pages/MembershipPage').then(m => ({ default: m.MembershipPage })))
const MembershipSuccessPage = lazy(() => import('@/pages/MembershipSuccessPage').then(m => ({ default: m.MembershipSuccessPage })))
const MinutesPage = lazy(() => import('@/pages/MinutesPage').then(m => ({ default: m.MinutesPage })))
const NewsPage = lazy(() => import('@/pages/NewsPage').then(m => ({ default: m.NewsPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const ScholasticPage = lazy(() => import('@/pages/ScholasticPage').then(m => ({ default: m.ScholasticPage })))
const SupportPage = lazy(() => import('@/pages/SupportPage').then(m => ({ default: m.SupportPage })))
const TournamentDetailPage = lazy(() => import('@/pages/TournamentDetailPage').then(m => ({ default: m.TournamentDetailPage })))
const TournamentManagePage = lazy(() => import('@/pages/TournamentManagePage').then(m => ({ default: m.TournamentManagePage })))
const TournamentPairingsPage = lazy(() => import('@/pages/TournamentPairingsPage').then(m => ({ default: m.TournamentPairingsPage })))
const TournamentsPage = lazy(() => import('@/pages/TournamentsPage').then(m => ({ default: m.TournamentsPage })))
function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <PasswordRecoveryRedirect />
      <ImpersonationBanner />
      <AnnouncementBanner />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div className="flex justify-center py-24 text-muted-foreground">Loading…</div>}>
          <Routes>
            {/* ── Public ── */}
            <Route path="/" element={<HomePage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            <Route path="/tournaments/:id/pairings" element={<TournamentPairingsPage />} />
            <Route path="/scholastic" element={<ScholasticPage />} />
            <Route path="/clubs" element={<ClubsPage />} />
            <Route path="/clubs/:id" element={<ClubDetailPage />} />
            <Route path="/news" element={<NewsPage />} />
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
            <Route path="/about" element={<AboutPage />} />
            <Route path="/governance" element={<GovernancePage />} />
            <Route path="/governance/board" element={<BoardPage />} />
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
            {/* ── Admin ── */}
            <Route path="/admin" element={<RoleProtectedRoute roles={['lca_admin', 'club_rep', 'tournament_director']}><AdminPage /></RoleProtectedRoute>} />
            <Route path="/admin/clubs/:id" element={<RoleProtectedRoute requireClubMatch><AdminClubPage /></RoleProtectedRoute>} />
            <Route path="/admin/email" element={<RoleProtectedRoute roles={['lca_admin']}><AdminEmailPage /></RoleProtectedRoute>} />
            <Route path="/admin/tournaments/:id" element={<RoleProtectedRoute roles={['lca_admin', 'club_rep', 'tournament_director']} requireTournamentAccess><TournamentManagePage /></RoleProtectedRoute>} />
            <Route path="/admin/support" element={<RoleProtectedRoute roles={['lca_admin']}><AdminSupportPage /></RoleProtectedRoute>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
export default App