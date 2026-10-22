// src/lib/api.ts
//
// The site's API client, re-exported from where each call lives: the
// shared request helpers and ApiError in src/lib/http.ts, and each
// area's calls in src/areas/<area>/api.ts (scripts/moves/api-split.json
// says which). Pages and components import from here; code inside an
// area may import its own area's api.ts directly. Area modules never
// import this file.
export { ApiError } from '@/lib/http'
export * from '@/areas/events/api'
export * from '@/areas/registration/api'
export * from '@/areas/households/api'
export * from '@/areas/live/api'
export * from '@/areas/membership/api'
export * from '@/areas/clubs/api'
export * from '@/areas/admin/api'
export * from '@/areas/governance/api'
