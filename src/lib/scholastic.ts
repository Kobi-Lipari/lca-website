// src/lib/scholastic.ts
//
// One definition of "scholastic" for the whole site. Previously forked:
// ScholasticPage matched section names on the LCA feed while TournamentsPage
// matched tournament names on the clearinghouse feed — same word, different
// result sets. A tournament is scholastic if EITHER signal fires. Each page
// keeps its own data source (ScholasticPage is LCA-only by decision).

const NAME_KEYWORDS = ['scholastic', 'youth', 'junior', 'kids', 'school']
const SECTION_KEYWORDS = ['k-12', 'k-8', 'k-5', 'scholastic', 'youth']

type SectionLike = string | { name?: string | null } | null | undefined

export function sectionName(s: SectionLike): string {
  return typeof s === 'string' ? s : s?.name ?? ''
}

export function isScholasticTournament(
  name: string,
  sections?: SectionLike[] | null,
): boolean {
  const n = name.toLowerCase()
  if (NAME_KEYWORDS.some((kw) => n.includes(kw))) return true
  if (!sections || sections.length === 0) return false
  return sections.some((s) => {
    const sn = sectionName(s).toLowerCase()
    return SECTION_KEYWORDS.some((kw) => sn.includes(kw))
  })
}