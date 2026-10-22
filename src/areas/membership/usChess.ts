// src/areas/membership/usChess.ts
//
// Where a player's US Chess membership stands, from their US Chess ID and
// the expiry date US Chess gives (checked nightly, and right away when an ID
// is added). The badge and the dashboard card in
// components/UsChessMembership.tsx show it; it lives here because a
// component file exports only components (react-refresh/only-export-components).

const SOON_DAYS = 45

export type UsChessState = 'none' | 'unknown' | 'valid' | 'soon' | 'expired'

export function usChessState(uscfId: string | null | undefined, expiration: string | null | undefined, now = new Date()): UsChessState {
  if (!uscfId) return 'none'
  if (!expiration) return 'unknown'
  const end = new Date(`${expiration.slice(0, 10)}T23:59:59`)
  if (Number.isNaN(end.getTime())) return 'unknown'
  if (end < now) return 'expired'
  return end.getTime() - now.getTime() < SOON_DAYS * 86_400_000 ? 'soon' : 'valid'
}
