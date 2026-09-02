// src/lib/mfa.ts
//
// Thin wrappers over Supabase's MFA API, so pages don't each have to know
// the enroll → challenge → verify shape.
//
// Recovery is deliberately manual: there are no self-service backup codes.
// An admin who loses their authenticator contacts the webmaster, who clears
// the factor from the Supabase dashboard. Rolling our own backup-code
// generation and storage would add a lot of security-sensitive surface to
// replace a path that already exists.

import { supabase } from '@/lib/supabase'

export interface EnrollResult {
  factorId: string
  /** SVG markup for the QR code, ready to inject. */
  qrCode: string
  /** The raw secret, for authenticator apps that take manual entry. */
  secret: string
}

/**
 * Starts TOTP enrolment. The factor exists but is unverified until a code
 * from it is accepted, so an abandoned enrolment never grants anything.
 */
export async function startTotpEnrollment(): Promise<EnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    // Distinguishes this entry in the member's authenticator app.
    friendlyName: `LCA ${new Date().toISOString().slice(0, 10)}`,
  })
  if (error) throw new Error(error.message)

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  }
}

/** Confirms enrolment, or steps an existing session up to aal2. */
export async function verifyTotpCode(
  factorId: string,
  code: string,
): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  })
  if (error) throw new Error(error.message)
}

export interface FactorSummary {
  id: string
  status: 'verified' | 'unverified'
  friendlyName: string | null
}

export async function listTotpFactors(): Promise<FactorSummary[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  return (data.totp ?? []).map((f) => ({
    id: f.id,
    status: f.status as 'verified' | 'unverified',
    friendlyName: f.friendly_name ?? null,
  }))
}

/**
 * Abandoned or superseded factors pile up otherwise: every visit to the
 * setup screen that isn't completed leaves an unverified factor behind.
 */
export async function removeFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}

export interface AssuranceState {
  current: string | null
  next: string | null
}

export async function getAssuranceLevel(): Promise<AssuranceState> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw new Error(error.message)
  return { current: data.currentLevel, next: data.nextLevel }
}

/**
 * True when this session has a verified factor it has not yet satisfied —
 * i.e. the login needs a code before it counts as aal2.
 */
export async function needsChallenge(): Promise<boolean> {
  const { current, next } = await getAssuranceLevel()
  return next === 'aal2' && current === 'aal1'
}
