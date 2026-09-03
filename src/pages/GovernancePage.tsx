// src/pages/GovernancePage.tsx
import { Link } from 'react-router-dom'
import { Clock, FileText, Landmark, Users } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { usePageTitle } from '@/hooks/usePageTitle'

const sections = [
  { icon: Landmark, label: 'About LCA',       sub: 'Our mission and history',                     href: '/about' },
  { icon: Users,    label: 'Board members',   sub: 'Current officers and directors',              href: '/governance/board' },
  { icon: FileText, label: 'Bylaws & rules',  sub: 'Constitution, tournament rules, and policies', href: '/governance/bylaws' },
  { icon: Clock,    label: 'Meeting minutes', sub: 'Board records and treasurer reports',         href: '/governance/minutes' },
]

export function GovernancePage() {
  usePageTitle('Governance')
  return (
    <div>
      <PageHero
        title="LCA governance"
        subtitle="Bylaws, board members, policies, and meeting records for the Louisiana Chess Association."
      />
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ icon: Icon, label, sub, href }) => (
            <Link key={href} to={href} className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#c8a94a]/10">
                <Icon className="size-5 text-[#c8a94a]" />
              </div>
              <div>
                <p className="font-semibold text-[#1a2744] group-hover:underline transition-colors">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}