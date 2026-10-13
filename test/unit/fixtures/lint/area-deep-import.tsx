// Lint fixture: area-boundaries.test.ts lints this text as if it sat at
// src/areas/households/components/AreaDeepImport.tsx. The first two imports
// reach into another area's files and must be warnings; the rest go through
// another area's index.ts or api.ts, or stay inside households, and pass.
// Nothing imports this file, and the default lint run skips it.
import { GradeConfirm } from '@/areas/events/components/GradeConfirm'
import { UsChessMembership } from '../../membership/components/UsChessMembership'
import { TOURNAMENT_STATUS } from '@/areas/events'
import { getTournament } from '@/areas/events/api'
import { getMyChildren } from '@/areas/households/api'
import { FamilyCard } from './FamilyCard'

export const AREA_DEEP_IMPORT = [GradeConfirm, UsChessMembership, TOURNAMENT_STATUS, getTournament, getMyChildren, FamilyCard]
