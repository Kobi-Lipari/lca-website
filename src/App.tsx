import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { AboutPage } from '@/pages/AboutPage'
import { AdminClubPage } from '@/pages/AdminClubPage'
import { AdminPage } from '@/pages/AdminPage'
import { ClubDetailPage } from '@/pages/ClubDetailPage'
import { ClubsPage } from '@/pages/ClubsPage'
import { ContactPage } from '@/pages/ContactPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { ManageClubPage } from '@/pages/ManageClubPage'
import { MembershipPage } from '@/pages/MembershipPage'
import { MembershipSuccessPage } from '@/pages/MembershipSuccessPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SupportPage } from '@/pages/SupportPage'
import { TournamentDetailPage } from '@/pages/TournamentDetailPage'
import { TournamentManagePage } from '@/pages/TournamentManagePage'
import { TournamentsPage } from '@/pages/TournamentsPage'

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/clubs" element={<ClubsPage />} />
            <Route path="/clubs/:id" element={<ClubDetailPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/membership" element={<MembershipPage />} />
            <Route path="/membership/success" element={<MembershipSuccessPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <RoleProtectedRoute roles={['lca_admin']}>
                  <AdminPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/clubs/:id"
              element={
                <RoleProtectedRoute requireClubMatch>
                  <AdminClubPage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/admin/tournaments/:id"
              element={
                <RoleProtectedRoute
                  roles={['lca_admin', 'club_rep', 'tournament_director']}
                  requireTournamentAccess
                >
                  <TournamentManagePage />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/manage/club"
              element={
                <RoleProtectedRoute roles={['club_rep']}>
                  <ManageClubPage />
                </RoleProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
