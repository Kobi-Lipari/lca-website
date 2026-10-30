// src/App.tsx
import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'
import { ADMIN_PANEL_ROLES, WORKSPACE_ROLES } from '@/areas/admin/roles'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { HomePage } from '@/pages/HomePage'
import { AnnouncementBanner } from '@/components/AnnouncementBanner'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { PasswordRecoveryRedirect } from '@/components/auth/PasswordRecoveryRedirect'
import { FEATURES } from '@/lib/features'
import { chromeOn } from '@/lib/nav'
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
// The accessibility test build's fixture page (vite build --mode a11y, see
// test/a11y). The build replaces import.meta.env.MODE with the mode's name,
// so every other build drops this import, the route below and the page's
// file; test/unit/feature-overrides.test.ts checks the site build for both.
const ScopeFixturePage = import.meta.env.MODE === 'a11y'
  ? lazy(() => import('@/pages/fixtures/ScopeFixturePage').then(m => ({ default: m.ScopeFixturePage })))
  : null
// The layout of the six heritage pages, in the Heritage Club look.
const HeritageLayout = lazy(() => import('@/layouts/HeritageLayout').then(m => ({ default: m.HeritageLayout })))
/**
 * The six pages drawn in the heritage look (HERITAGE_ROUTES in
 * src/lib/themeScopes.ts), written once. With themeHeritage on they sit in
 * HeritageLayout, a layout route with no path of its own; with it off they
 * are listed with the rest, as they always were.
 */
const HERITAGE_PAGES = (
  <>
    <Route path="/meeting" element={<AnnualMeetingPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/governance/board" element={<BoardPage />} />
    <Route path="/champions" element={<ChampionsPage />} />
    <Route path="/governance/bylaws" element={<BylawsPage />} />
    <Route path="/governance/minutes" element={<MinutesPage />} />
  </>
)
/** The page's main, where "Skip to content" takes the focus. */
const MAIN_ID = 'main-content'

/**
 * "Skip to content", drawn only with the chrome on (newNav and newLook,
 * chromeOn in src/lib/nav.ts): the first thing Tab reaches on every page,
 * before the banners and the header. It is hidden until it has the focus,
 * then drawn at the top left of the window above the header, on a ground of
 * its own (its ring is drawn inside it, src/index.css). It moves the focus
 * to the page's main without putting #main-content in the address; the href
 * keeps it there for a browser that runs no script.
 *
 * The main can take the focus only from here, and only until it lets it go:
 * a main that could always take it would take it from a click on any of its
 * text, and the next Tab would then start from the main's top rather than
 * from where the click was.
 */
function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      data-skip-link=""
      onClick={(event) => {
        const main = document.getElementById(MAIN_ID)
        if (!main) return
        event.preventDefault()
        main.setAttribute('tabindex', '-1')
        main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true })
        main.focus()
      }}
      className="sr-only rounded-md bg-raised text-sm font-semibold text-ink shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:px-4 focus:py-2 print:hidden"
    >
      Skip to content
    </a>
  )
}

/**
 * The line shown while a page's code arrives. With the chrome on it holds
 * the height of the window under the header, with today's row at its top
 * (--header-h, which the new header writes from 1024 pixels up; below that,
 * and before the header has measured itself, it stands at 64px), and
 * it carries data-loading-line: while it shows, the footer is not drawn
 * (src/index.css), so the footer comes with the page and neither drops out
 * of view as a taller page arrives nor rises into view as a shorter one
 * does (the brief's AC23). With the chrome off it is today's line.
 */
function LoadingLine({ tall }: { tall: boolean }) {
  if (!tall) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 py-24 text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }
  return (
    <div
      role="status"
      aria-live="polite"
      data-loading-line=""
      className="min-h-[calc(100vh-var(--header-h,64px))] py-24 text-muted-foreground"
    >
      <div className="flex items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  )
}

function App() {
  // Read on every draw, not when the module loads, so the switches a test sets are the ones it sees.
  const chrome = chromeOn()
  return (
    <div className="flex min-h-screen flex-col">
      {chrome && <SkipLink />}
      <PasswordRecoveryRedirect />
      <ImpersonationBanner />
      <AnnouncementBanner />
      <Navbar />
      <main className="flex-1" {...(chrome ? { id: MAIN_ID } : {})}>
        <Suspense fallback={<LoadingLine tall={chrome} />}>
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
            {FEATURES.themeHeritage ? <Route element={<HeritageLayout />}>{HERITAGE_PAGES}</Route> : HERITAGE_PAGES}
            {/* The old governance landing page is retired: the navbar opens on
                Board members, and GovLayout links to the rest from there. */}
            <Route path="/governance" element={<Navigate to="/governance/board" replace />} />
            <Route path="/state-champions" element={<Navigate to="/champions" replace />} />
            {/* RulesPage retired: its content merged into /governance/bylaws */}
            <Route path="/governance/rules" element={<Navigate to="/governance/bylaws" replace />} />
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
            <Route path="/admin/tournaments/:id" element={<RoleProtectedRoute roles={['lca_admin', 'lca_observer', 'lca_officer', 'club_rep', 'tournament_director']} allowDirectors requireTournamentAccess><TournamentManagePage /></RoleProtectedRoute>} />
            {/* ── Accessibility test build only (see ScopeFixturePage above) ── */}
            {import.meta.env.MODE === 'a11y' && ScopeFixturePage && (
              <Route path="/__fixtures/:name" element={<ScopeFixturePage />} />
            )}
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
export default App