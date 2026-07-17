// src/pages/AboutPage.tsx
import { Link } from 'react-router-dom'
import { GovLayout } from '@/components/governance/GovLayout'
import { usePageTitle } from '@/hooks/usePageTitle'

export function AboutPage() {
  usePageTitle('About LCA')
  return (
    <GovLayout title="About LCA" subtitle="The Louisiana Chess Association">
      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="mb-3 text-xl font-bold text-[#1a2744]">Who we are</h2>
          <p>The Louisiana Chess Association (LCA) is the official state chess organization for Louisiana, affiliated with the United States Chess Federation (USCF). We serve chess players of all ages and skill levels across the state.</p>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-bold text-[#1a2744]">Our mission</h2>
          <p>The LCA promotes and develops chess throughout Louisiana through sanctioned tournaments, club support, scholastic outreach, and community building. We believe chess is for everyone — beginners and grandmasters alike.</p>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-bold text-[#1a2744]">What we do</h2>
          <ul className="ml-4 list-disc space-y-2">
            <li>Sanction and organize USCF-rated chess tournaments across Louisiana</li>
            <li>Support affiliated chess clubs in 7 regions statewide</li>
            <li>Promote scholastic chess in K–12 schools</li>
            <li>Maintain official ratings and membership records</li>
            <li>Represent Louisiana in national USCF governance</li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-bold text-[#1a2744]">USCF affiliation</h2>
          <p>The LCA is a USCF-affiliated state organization. All LCA-sanctioned tournaments count toward USCF national ratings. LCA members in good standing are eligible to participate in national USCF events.</p>
        </div>
        <div className="rounded-xl border-[3px] border-[#c8a94a] bg-[#1a2744] p-6 text-white">
          <h3 className="mb-2 font-semibold">Get involved</h3>
          <p className="text-sm text-white/65">Whether you want to play in tournaments, join a club, or help grow chess in Louisiana — we'd love to have you.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/membership" className="rounded-md bg-[#c8a94a] px-4 py-2 text-sm font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">Join LCA</Link>
            <Link to="/contact" className="rounded-md border border-white/25 px-4 py-2 text-sm text-white hover:bg-white/10">Contact us</Link>
          </div>
        </div>
      </div>
    </GovLayout>
  )
}