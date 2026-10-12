// src/lib/scholastic.ts
//
// One definition of "scholastic" for the whole site. Previously forked:
// ScholasticPage matched section names on the LCA feed while TournamentsPage
// matched tournament names on the clearinghouse feed — same word, different
// result sets. A tournament is scholastic if EITHER signal fires. Each page
// keeps its own data source (ScholasticPage is LCA-only by decision).

import type { ApiTournamentSection } from '@/lib/api'

const NAME_KEYWORDS = ['scholastic', 'youth', 'junior', 'kids', 'school']
const SECTION_KEYWORDS = ['k-12', 'k-8', 'k-5', 'scholastic', 'youth']

export function isScholasticTournament(
  name: string,
  sections?: Array<Pick<ApiTournamentSection, 'name'>> | null,
): boolean {
  const n = name.toLowerCase()
  if (NAME_KEYWORDS.some((kw) => n.includes(kw))) return true
  if (!sections || sections.length === 0) return false
  return sections.some((s) => {
    const sn = s.name.toLowerCase()
    return SECTION_KEYWORDS.some((kw) => sn.includes(kw))
  })
}