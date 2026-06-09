import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { AboutPage } from '@/pages/AboutPage'
import { ClubDetailPage } from '@/pages/ClubDetailPage'
import { ClubsPage } from '@/pages/ClubsPage'
import { ContactPage } from '@/pages/ContactPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { MembershipPage } from '@/pages/MembershipPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { TournamentDetailPage } from '@/pages/TournamentDetailPage'
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
            <Route path="/dashboard" element={<DashboardPage />} />
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