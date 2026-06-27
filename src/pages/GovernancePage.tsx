import { Link } from 'react-router-dom'
import { FileText, Gavel, Users, Clock, Coins, Edit } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

const sections = [
  { icon: Users,    label: 'About LCA',        sub: 'Our mission and history',           href: '/about' },
  { icon: Users,    label: 'Board members',     sub: 'Current officers and directors',    href: '/governance/board' },
  { icon: FileText, label: 'Bylaws',            sub: 'Official LCA constitution',         href: '/governance/bylaws' },
  { icon: Gavel,    label: 'Rules & policies',  sub: 'Tournament and conduct rules',      href: '/governance/rules' },
  { icon: Clock,    label: 'Meeting minutes',   sub: 'Board records and treasurer reports',href: '/governance/minutes' },
]

export function GovernancePage() {
  usePageTitle('Governance')
  return (
    <div>
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-2 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]">Governance</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">LCA governance</h1>
          <p className="mt-2 text-sm text-white/60">Bylaws, board members, policies, and meeting records for the Louisiana Chess Association.</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ icon: Icon, label, sub, href }) => (
            <Link key={href} to={href} className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#c8a94a]/10">
                <Icon className="size-5 text-[#c8a94a]" />
              </div>
              <div>
                <p className="font-semibold text-[#1a2744] group-hover:text-[#c8a94a] transition-colors">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}