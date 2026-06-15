import { Link } from 'react-router-dom'
import {
  Calendar,
  CreditCard,
  History,
  LayoutDashboard,
  Trophy,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

type MembershipStatus = 'active' | 'expired' | 'pending'

interface MembershipInfo {
  uscfId?: string
  rating?: number
  membershipStatus: MembershipStatus
  membershipExpiry: string
}

interface UpcomingRegistration {
  id: string
  tournamentId: string
  tournamentName: string
  date: string
  location: string
  section: string
  paymentStatus: 'paid' | 'pending'
}

interface TournamentHistoryItem {
  id: string
  tournamentName: string
  date: string
  section: string
  place: number
  score: string
}

const membershipInfo: MembershipInfo = {
  uscfId: undefined,
  rating: undefined,
  membershipStatus: 'pending',
  membershipExpiry: 'Not yet purchased',
}

const upcomingRegistrations: UpcomingRegistration[] = [
  {
    id: 'reg-1',
    tournamentId: 'spring-open-2026',
    tournamentName: 'LCA Spring Open',
    date: 'Saturday, March 14, 2026',
    location: 'Baton Rouge, LA',
    section: 'Open',
    paymentStatus: 'paid',
  },
  {
    id: 'reg-2',
    tournamentId: 'new-orleans-classic-2026',
    tournamentName: 'New Orleans Classic',
    date: 'Saturday, April 18, 2026',
    location: 'New Orleans, LA',
    section: 'Open',
    paymentStatus: 'pending',
  },
]

const tournamentHistory: TournamentHistoryItem[] = [
  {
    id: 'hist-1',
    tournamentName: 'Louisiana State Championship',
    date: 'November 15, 2025',
    section: 'Championship',
    place: 2,
    score: '5.5/7',
  },
  {
    id: 'hist-2',
    tournamentName: 'Baton Rouge Fall Open',
    date: 'October 11, 2025',
    section: 'Open',
    place: 1,
    score: '4.5/5',
  },
  {
    id: 'hist-3',
    tournamentName: 'Lafayette Winter Classic',
    date: 'February 8, 2025',
    section: 'Open',
    place: 3,
    score: '3.5/5',
  },
]

const statusConfig: Record<
  MembershipStatus,
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-800',
  },
  expired: {
    label: 'Expired',
    className: 'bg-destructive/10 text-destructive',
  },
  pending: {
    label: 'Pending',
    className: 'bg-[#c8a94a]/20 text-[#1a2744]',
  },
}

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function DashboardPage() {
  const { user } = useAuth()

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Member'
  const email = user?.email ?? ''
  const uscfId =
    membershipInfo.uscfId ||
    (user?.user_metadata?.uscf_id as string | undefined)

  const status = statusConfig[membershipInfo.membershipStatus]

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                My Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Welcome back, {displayName}. Manage your membership, view
                registrations, and track your tournament history.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-sm text-muted-foreground">
          Tournament and membership data below are placeholders until D1 is
          connected.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-1">
            <div className="flex items-center gap-2">
              <User className="size-5 text-[#c8a94a]" />
              <h2 className="text-lg font-bold text-[#1a2744]">Profile</h2>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-[#1a2744]">Name</dt>
                <dd className="text-muted-foreground">{displayName}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1a2744]">Email</dt>
                <dd className="text-muted-foreground">{email}</dd>
              </div>
              {uscfId && (
                <div>
                  <dt className="font-medium text-[#1a2744]">USCF ID</dt>
                  <dd className="text-muted-foreground">{uscfId}</dd>
                </div>
              )}
              {membershipInfo.rating != null && (
                <div>
                  <dt className="font-medium text-[#1a2744]">Rating</dt>
                  <dd className="text-muted-foreground">
                    {membershipInfo.rating}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="size-5 text-[#c8a94a]" />
                <h2 className="text-lg font-bold text-[#1a2744]">
                  Membership
                </h2>
              </div>
              <span
                className={cn(
                  'w-fit rounded-full px-2.5 py-0.5 text-xs font-medium',
                  status.className,
                )}
              >
                {status.label}
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Your LCA membership is valid through{' '}
              <span className="font-medium text-[#1a2744]">
                {membershipInfo.membershipExpiry}
              </span>
              .
            </p>

            <Button asChild className={cn('mt-4', goldButtonClass)}>
              <Link to="/membership">Join / Renew Membership</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2">
            <Calendar className="size-6 text-[#c8a94a]" />
            <h2 className="text-2xl font-bold text-[#1a2744]">
              Upcoming Registrations
            </h2>
          </div>
          <p className="mt-1 text-muted-foreground">
            Tournaments you are registered for.
          </p>

          {upcomingRegistrations.length > 0 ? (
            <ul className="mt-8 space-y-4">
              {upcomingRegistrations.map((reg) => (
                <li
                  key={reg.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-[#1a2744]">
                      {reg.tournamentName}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reg.date} · {reg.location} · {reg.section}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        reg.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[#c8a94a]/20 text-[#1a2744]',
                      )}
                    >
                      {reg.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/tournaments/${reg.tournamentId}`}>View</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">
              No upcoming registrations.{' '}
              <Link to="/tournaments" className="text-[#c8a94a] hover:underline">
                Browse tournaments
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center gap-2">
          <History className="size-6 text-[#c8a94a]" />
          <h2 className="text-2xl font-bold text-[#1a2744]">
            Tournament History
          </h2>
        </div>
        <p className="mt-1 text-muted-foreground">
          Your past results and standings.
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 font-semibold text-[#1a2744]">
                  Tournament
                </th>
                <th className="px-4 py-3 font-semibold text-[#1a2744]">Date</th>
                <th className="px-4 py-3 font-semibold text-[#1a2744]">
                  Section
                </th>
                <th className="px-4 py-3 font-semibold text-[#1a2744]">Place</th>
                <th className="px-4 py-3 font-semibold text-[#1a2744]">Score</th>
              </tr>
            </thead>
            <tbody>
              {tournamentHistory.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{item.tournamentName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.date}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.section}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.place}
                    {item.place === 1 && (
                      <Trophy className="ml-1 inline size-3.5 text-[#c8a94a]" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
