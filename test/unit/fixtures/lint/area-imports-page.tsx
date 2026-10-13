// Lint fixture: area-boundaries.test.ts lints this text as if it sat at
// src/areas/events/components/AreaImportsPage.tsx, where each import below
// reaches a page and must be an error. Nothing imports this file, and the
// default lint run skips it.
import { HomePage } from '@/pages/HomePage'
import { TournamentsPage } from '../../../pages/TournamentsPage'
import type { ScholasticPage } from '../../../../src/pages/ScholasticPage'

export function AreaImportsPage({ page }: { page?: typeof ScholasticPage }) {
  return page ? <HomePage /> : <TournamentsPage />
}
