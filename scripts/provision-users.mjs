#!/usr/bin/env node
// scripts/provision-users.mjs
//
// One-off bulk provisioning for LCA launch. Two independent, idempotent steps:
//
//   1. provision — create Supabase Auth users (email pre-confirmed) and emit
//      provision.sql with D1 upserts for the members table. Nothing is emailed.
//
//        node scripts/provision-users.mjs provision members.tsv --dry-run
//        node scripts/provision-users.mjs provision members.tsv
//        npx wrangler d1 execute lca-db --remote --file=scripts/provision.sql
//
//   2. announce — later, when the board says go: generate a password-reset
//      link per user and send the branded "your account is ready" email via
//      Resend. Tracks sends in scripts/launch-emails-sent.json so re-running
//      never double-emails anyone.
//
//        node scripts/provision-users.mjs announce members.tsv --dry-run
//        node scripts/provision-users.mjs announce members.tsv --limit=5   # pilot batch
//        node scripts/provision-users.mjs announce members.tsv
//
// Input: a UTF-8 TSV with a header row. Recognized columns (order-free):
//   email (required) · full_name (required) · role (member|club_rep|lca_admin,
//   default member — board members stay 'member' for later promotion) ·
//   club_id (D1 club id, NOT a club name; optional) · uscf_id (optional) ·
//   membership_status (default active) · membership_expiry (YYYY-MM-DD,
//   default 1 year from today) · membership_type (optional, e.g. adult/
//   scholastic/family/senior)
//
// Env vars required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY           (both steps)
//   RESEND_API_KEY, FROM_EMAIL                        (announce step)
//   SITE_URL   optional, default https://lca-website.pages.dev

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ── CLI parsing ───────────────────────────────────────────────────────────────

const [, , command, tsvPath, ...rest] = process.argv
const DRY_RUN = rest.includes('--dry-run')
const LIMIT = (() => {
  const arg = rest.find((a) => a.startsWith('--limit='))
  return arg ? Number(arg.split('=')[1]) : Infinity
})()
const SQL_OUT = (() => {
  const arg = rest.find((a) => a.startsWith('--sql-out='))
  return arg ? arg.split('=')[1] : 'scripts/provision.sql'
})()

const SITE_URL = process.env.SITE_URL ?? 'https://lca-website.pages.dev'
const SENT_LOG = 'scripts/launch-emails-sent.json'

if (!['provision', 'announce'].includes(command) || !tsvPath) {
  console.error('Usage: node scripts/provision-users.mjs <provision|announce> <members.tsv> [--dry-run] [--limit=N]')
  process.exit(1)
}

// ── TSV parsing + validation ──────────────────────────────────────────────────

const VALID_ROLES = new Set(['member', 'club_rep', 'lca_admin', 'tournament_director'])
const VALID_STATUSES = new Set(['active', 'expired', 'pending'])

function oneYearFromNow() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

function parseTsv(path) {
  const raw = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trim()
  const lines = raw.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('TSV needs a header row and at least one data row')

  const headers = lines[0].split('\t').map((h) => h.trim().toLowerCase())
  const need = ['email', 'full_name']
  for (const col of need) {
    if (!headers.includes(col)) throw new Error(`TSV missing required column: ${col}`)
  }

  const rows = []
  const errors = []
  const seenEmails = new Set()

  lines.slice(1).forEach((line, i) => {
    const cells = line.split('\t')
    const get = (name) => {
      const idx = headers.indexOf(name)
      return idx === -1 ? '' : (cells[idx] ?? '').trim()
    }
    const lineNo = i + 2

    const email = get('email').toLowerCase()
    const full_name = get('full_name')
    const role = get('role') || 'member'
    const membership_status = get('membership_status') || 'active'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`line ${lineNo}: bad email "${email}"`)
    if (seenEmails.has(email)) errors.push(`line ${lineNo}: duplicate email "${email}"`)
    seenEmails.add(email)
    if (!full_name) errors.push(`line ${lineNo}: missing full_name`)
    if (!VALID_ROLES.has(role)) errors.push(`line ${lineNo}: bad role "${role}"`)
    if (!VALID_STATUSES.has(membership_status)) errors.push(`line ${lineNo}: bad membership_status "${membership_status}"`)

    rows.push({
      email,
      full_name,
      role,
      club_id: get('club_id') || null,
      uscf_id: get('uscf_id') || null,
      membership_status,
      membership_expiry: get('membership_expiry') || oneYearFromNow(),
      membership_type: get('membership_type') || null,
    })
  })

  if (errors.length) {
    console.error(`\n✗ ${errors.length} validation error(s):`)
    errors.forEach((e) => console.error('  - ' + e))
    process.exit(1)
  }
  return rows
}

// ── Supabase admin helpers ────────────────────────────────────────────────────

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** Page through every auth user once and build an email → id map. */
async function fetchAllAuthUsers(supabase) {
  const map = new Map()
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error('listUsers failed: ' + error.message)
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id)
    }
    if (data.users.length < 1000) break
    page++
  }
  return map
}

function sqlString(v) {
  if (v === null || v === undefined) return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

// ── Step 1: provision ────────────────────────────────────────────────────────

async function provision(rows) {
  const supabase = supabaseAdmin()
  console.log('Fetching existing Supabase users…')
  const existing = await fetchAllAuthUsers(supabase)
  console.log(`  ${existing.size} auth users already exist`)

  const toCreate = rows.filter((r) => !existing.has(r.email))
  const alreadyThere = rows.length - toCreate.length
  console.log(`  ${alreadyThere} of ${rows.length} TSV rows already have auth accounts`)
  console.log(`  ${toCreate.length} to create`)

  if (DRY_RUN) {
    toCreate.slice(0, 10).forEach((r) => console.log(`  would create: ${r.email} (${r.full_name}, ${r.role})`))
    if (toCreate.length > 10) console.log(`  … and ${toCreate.length - 10} more`)
    console.log('\n--dry-run: no users created, no SQL written.')
    return
  }

  let created = 0
  const failures = []
  for (const row of toCreate) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.email,
      email_confirm: true, // no confirmation email; they set a password via the announce step
      user_metadata: { full_name: row.full_name, role: row.role, club_id: row.club_id },
    })
    if (error) {
      failures.push(`${row.email}: ${error.message}`)
      continue
    }
    existing.set(row.email, data.user.id)
    created++
    if (created % 25 === 0) console.log(`  created ${created}/${toCreate.length}…`)
  }
  console.log(`✓ created ${created} auth users${failures.length ? `, ${failures.length} FAILED` : ''}`)
  failures.forEach((f) => console.error('  ✗ ' + f))

  // Emit idempotent D1 upserts, keyed on the Supabase auth id (= members.id).
  const stmts = rows
    .filter((r) => existing.has(r.email))
    .map((r) => {
      const id = existing.get(r.email)
      return (
        `INSERT INTO members (id, email, full_name, uscf_id, role, club_id, membership_status, membership_expiry, membership_type)\n` +
        `VALUES (${sqlString(id)}, ${sqlString(r.email)}, ${sqlString(r.full_name)}, ${sqlString(r.uscf_id)}, ${sqlString(r.role)}, ${sqlString(r.club_id)}, ${sqlString(r.membership_status)}, ${sqlString(r.membership_expiry)}, ${sqlString(r.membership_type)})\n` +
        `ON CONFLICT(id) DO UPDATE SET\n` +
        `  full_name = excluded.full_name,\n` +
        `  uscf_id = COALESCE(excluded.uscf_id, members.uscf_id),\n` +
        `  role = excluded.role,\n` +
        `  club_id = COALESCE(excluded.club_id, members.club_id),\n` +
        `  membership_status = excluded.membership_status,\n` +
        `  membership_expiry = excluded.membership_expiry,\n` +
        `  membership_type = COALESCE(excluded.membership_type, members.membership_type);`
      )
    })

  writeFileSync(SQL_OUT, `-- generated by provision-users.mjs on ${new Date().toISOString()}\n-- ${stmts.length} member upserts\n\n` + stmts.join('\n\n') + '\n')
  console.log(`✓ wrote ${stmts.length} upserts to ${SQL_OUT}`)
  console.log(`\nNext: review the file, then apply it once:`)
  console.log(`  npx wrangler d1 execute lca-db --remote --file=${SQL_OUT}`)
}

// ── Step 2: announce ─────────────────────────────────────────────────────────

function announcementHtml(name, resetLink) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f2;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e0">
    <div style="background:#1a2744;padding:24px;border-bottom:3px solid #c8a94a">
      <p style="margin:0;color:#c8a94a;font-size:12px;letter-spacing:2px;text-transform:uppercase">Louisiana Chess Association</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px">Your LCA account is ready</h1>
    </div>
    <div style="padding:24px;color:#333;font-size:14px;line-height:1.6">
      <p>Hi ${name},</p>
      <p>The LCA's new website is live at <a href="${SITE_URL}" style="color:#1a2744;font-weight:600">${SITE_URL.replace('https://', '')}</a> — tournament registration, club pages, membership, and more, all in one place.</p>
      <p>We've already set up your member account. Click below to choose your password and sign in:</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${resetLink}" style="background:#c8a94a;color:#1a2744;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;display:inline-block">Set my password</a>
      </p>
      <p style="font-size:12px;color:#777">This link expires after a short time. If it stops working, use "Forgot password" on the site's login page with this email address — that sends a fresh link.</p>
      <p>See you over the board,<br/>The Louisiana Chess Association</p>
    </div>
  </div></body></html>`
}

async function announce(rows) {
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL
  if (!DRY_RUN && (!resendKey || !fromEmail)) {
    console.error('Set RESEND_API_KEY and FROM_EMAIL')
    process.exit(1)
  }

  const supabase = supabaseAdmin()
  const sent = existsSync(SENT_LOG) ? JSON.parse(readFileSync(SENT_LOG, 'utf8')) : {}
  const pending = rows.filter((r) => !sent[r.email]).slice(0, LIMIT)
  console.log(`${Object.keys(sent).length} already sent, ${pending.length} to send${Number.isFinite(LIMIT) ? ` (limit ${LIMIT})` : ''}`)

  if (DRY_RUN) {
    pending.slice(0, 10).forEach((r) => console.log(`  would email: ${r.email}`))
    if (pending.length > 10) console.log(`  … and ${pending.length - 10} more`)
    console.log('\n--dry-run: no links generated, no emails sent.')
    return
  }

  let ok = 0
  for (const row of pending) {
    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: row.email,
        options: { redirectTo: `${SITE_URL}/reset-password` },
      })
      if (error) throw new Error('generateLink: ' + error.message)
      const link = data.properties?.action_link
      if (!link) throw new Error('no action_link returned')

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: row.email,
          subject: 'Your Louisiana Chess Association account is ready',
          html: announcementHtml(row.full_name.split(' ')[0] || 'there', link),
        }),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)

      sent[row.email] = new Date().toISOString()
      writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2)) // persist after EVERY send — a crash never re-emails
      ok++
      if (ok % 10 === 0) console.log(`  sent ${ok}/${pending.length}…`)
      await new Promise((r) => setTimeout(r, 600)) // stay under Resend rate limits
    } catch (err) {
      console.error(`  ✗ ${row.email}: ${err.message}`)
    }
  }
  console.log(`✓ sent ${ok}/${pending.length} announcement emails (log: ${SENT_LOG})`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const rows = parseTsv(tsvPath)
console.log(`Parsed ${rows.length} valid rows from ${tsvPath}${DRY_RUN ? '  [DRY RUN]' : ''}\n`)

if (command === 'provision') await provision(rows)
else await announce(rows)
