// scripts/send-launch-emails.mjs — STEP 2 of 2: announce profiles + password setup.
// Run this only when you're ready for members to hear about the site.
//
// For each row in scripts/lca-import.tsv it:
//   1. Skips any email ending in .invalid (the five fake-email profiles)
//   2. Skips anyone already logged in scripts/launch-emails-sent.json (idempotent —
//      safe to re-run after a partial failure; only unsent people get emailed)
//   3. Generates a Supabase recovery (set-password) link via the Admin API
//   4. Sends a branded email through Resend, addressed by name, with the
//      "not you? reply and we'll fix it" line per K
//
// Usage:
//   export SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… RESEND_API_KEY=…
//   node scripts/send-launch-emails.mjs --dry-run     # ALWAYS first
//   node scripts/send-launch-emails.mjs               # real send
//   node scripts/send-launch-emails.mjs --only you@example.com   # test on yourself first!
//
// Recommended order: real run with --only <your own email> (add yourself to the
// TSV temporarily), confirm it in Resend Logs and your inbox, THEN the full run.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry-run')
const onlyIdx = process.argv.indexOf('--only')
const ONLY = onlyIdx > -1 ? process.argv[onlyIdx + 1]?.toLowerCase() : null

const need = (k) => {
  const v = process.env[k]
  if (!v) { console.error(`Missing env var ${k}`); process.exit(1) }
  return v
}
const SUPABASE_URL = need('SUPABASE_URL')
const SERVICE_KEY = need('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_KEY = need('RESEND_API_KEY')
const FROM = process.env.FROM_EMAIL ?? 'noreply@louisianachess.org'
const REPLY_TO = process.env.REPLY_TO_EMAIL ?? 'contact@louisianachess.org'
const SITE_URL = process.env.SITE_URL ?? 'https://lca-website.pages.dev'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SENT_LOG = new URL('./launch-emails-sent.json', import.meta.url)
const sent = existsSync(SENT_LOG) ? JSON.parse(readFileSync(SENT_LOG, 'utf8')) : {}
const saveLog = () => writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2))

const escapeHtml = (s) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function launchEmail(name, link) {
  const n = escapeHtml(name)
  return {
    subject: 'Your Louisiana Chess Association profile is ready',
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1a2744;padding:20px;text-align:center">
          <span style="color:#c8a94a;font-size:20px;font-weight:bold">Louisiana Chess Association</span>
        </div>
        <div style="padding:24px;color:#1a2744">
          <h2 style="margin-top:0">Welcome to the new LCA website</h2>
          <p>Hi ${n},</p>
          <p>A member profile has been created for <strong>${n}</strong> on the new
          Louisiana Chess Association website. Your membership record — including your
          current status and expiration date — is already on it.</p>
          <p>To start using your account, set your password here:</p>
          <p style="text-align:center;margin:28px 0">
            <a href="${link}" style="background:#c8a94a;color:#1a2744;padding:12px 28px;text-decoration:none;font-weight:bold;border-radius:4px">Set my password</a>
          </p>
          <p>Once you're in, you can view and register for upcoming LCA tournaments,
          see club information from around the state, and manage your membership.</p>
          <p style="font-size:13px;color:#555">Not ${n}, or is this the wrong email
          for this member? Just reply to this message and we'll fix it — no action needed
          on the link above.</p>
          <p>— Louisiana Chess Association</p>
        </div>
      </div>
    `,
    text: `Hi ${name},\n\nA member profile has been created for ${name} on the new Louisiana Chess Association website. Set your password to get started: ${link}\n\nNot ${name}, or wrong email for this member? Reply to this message and we'll fix it.\n\n— Louisiana Chess Association`,
  }
}

// --- read TSV ---
const lines = readFileSync(new URL('./lca-import.tsv', import.meta.url), 'utf8')
  .split('\n').map((l) => l.replace(/\r$/, '')).filter(Boolean)
const header = lines[0].split('\t')
let rows = lines.slice(1).map((l) => {
  const cells = l.split('\t')
  return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()]))
})
if (ONLY) rows = rows.filter((r) => r.email.toLowerCase() === ONLY)

const summary = { sent: 0, skippedInvalid: 0, skippedAlready: 0, failed: 0 }

for (const r of rows) {
  const email = r.email.toLowerCase()
  const label = `${r.full_name} <${email}>`

  if (email.endsWith('.invalid')) {
    console.log(`SKIP   ${label} — placeholder address, never emailed`)
    summary.skippedInvalid++
    continue
  }
  if (sent[email]) {
    console.log(`SKIP   ${label} — already sent ${sent[email]}`)
    summary.skippedAlready++
    continue
  }
  if (DRY) {
    console.log(`WOULD  ${label}`)
    summary.sent++
    continue
  }

  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${SITE_URL}/account` },
    })
    if (error) throw error
    const link = data.properties?.action_link
    if (!link) throw new Error('no action_link returned')

    const msg = launchEmail(r.full_name, link)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Louisiana Chess Association <${FROM}>`,
        reply_to: REPLY_TO,
        to: [email],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)

    sent[email] = new Date().toISOString()
    saveLog() // persist after every send: a crash mid-run loses nothing
    console.log(`SENT   ${label}`)
    summary.sent++
    await new Promise((s) => setTimeout(s, 600)) // stay under Resend rate limits
  } catch (err) {
    console.error(`FAIL   ${label} — ${err.message}`)
    summary.failed++
  }
}

console.log(`\nDone. sent=${summary.sent} skipped(placeholder)=${summary.skippedInvalid} skipped(already)=${summary.skippedAlready} failed=${summary.failed}`)
if (summary.failed) {
  console.log('Re-run to retry failures only — successful sends are logged and skipped.')
  process.exit(1)
}
