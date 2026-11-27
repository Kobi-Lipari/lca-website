// src/pages/ClubListingPage.tsx
//
// /clubs/:id while the new club pages are on (clubPagesOn: newClubs and
// newLook together, WS09 step 21): the club's listing as the new club page
// draws it (src/areas/clubs/components/ClubPage.tsx), asked for by the
// address it was opened at, whether the club's slug, an old slug or its id.
// src/App.tsx routes the address here only then; with either switch off it
// draws today's ClubDetailPage, whose file this page leaves as it is.
import { useParams } from 'react-router-dom'

import { ClubPage } from '@/areas/clubs/components/ClubPage'

export function ClubListingPage() {
  const { id = '' } = useParams<{ id: string }>()
  return <ClubPage address={id} />
}
