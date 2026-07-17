// src/pages/BylawsPage.tsx
import { GovLayout } from '@/components/governance/GovLayout'
import { GovernanceDocuments } from '@/components/governance/GovernanceDocuments'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'

export function BylawsPage() {
  usePageTitle('Bylaws & Rules')
  const { role } = useAuth()
  const isAdmin = role === 'lca_admin'

  return (
    <GovLayout
      title="Bylaws & rules"
      subtitle="The LCA constitution, amendments, and tournament rules"
    >
      <div className="space-y-8">
        <GovernanceDocuments category="amendments" title="Proposed amendments" isAdmin={isAdmin} layout="preview" />
        <GovernanceDocuments category="bylaws" title="Bylaws documents" isAdmin={isAdmin} layout="preview" />
        {/* RulesPage was retired; its document category lives on here so the
            board can still publish rules/policy documents when they exist. */}
        <GovernanceDocuments category="rules" title="Rules & policy documents" isAdmin={isAdmin} layout="preview" />

        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="mb-2 text-base font-bold text-[#1a2744]">Tournament rules</h2>
            <p>All LCA-sanctioned tournaments are conducted under USCF Official Rules of Chess. Specific time controls, pairing systems, and tiebreak methods are listed on each tournament's detail page.</p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-bold text-[#1a2744]">Electronic devices</h2>
            <p>Electronic devices capable of chess analysis must be turned off and stored out of reach during play. Violation may result in forfeiture of the game.</p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-bold text-[#1a2744]">Code of conduct</h2>
            <p>All participants are expected to behave respectfully toward opponents, directors, and spectators. Unsportsmanlike conduct may result in removal from the tournament without refund.</p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-bold text-[#1a2744]">Appeals</h2>
            <p>Rulings by the tournament director may be appealed to the appeals committee. Appeals must be submitted in writing within 30 minutes of the disputed ruling.</p>
          </div>
        </div>
      </div>
    </GovLayout>
  )
}