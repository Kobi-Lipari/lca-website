// scripts/provision-members.mjs — STEP 1 of 2: create profiles. Sends NO email.
//
// Reads scripts/lca-import.tsv, and for each row:
//   1. Skips entirely if a members row with that email already exists in D1 (idempotent)
//   2. Creates the Supabase auth user (email_confirm: true, no password)
//      — including the fakeemail…@lca.invalid rows, so every member has a real uid
//      — if the auth user already exists, reuses its uid
//   3. Inserts the D1 members row (role 'member', status/expiry/type from the sheet)
//
// Usage (from repo root, in Codespaces):
//   export SUPABASE_URL=…                  # same one the site uses
//   export SUPABASE_SERVICE_ROLE_KEY=…     # service role, NOT anon
//   export CLOUDFLARE_API_TOKEN=…          # you re-export this each session anyway
//   export CF_ACCOUNT_ID=…                 # dashboard → Workers & Pages → right sidebar
//   node scripts/provision-members.mjs --dry-run   # ALWAYS dry-run first
//   node scripts/provision-members.mjs             # real run
//
// Do NOT commit this script's TSV once you consider it stale — the DB is truth after import.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const D1_DATABASE_ID = 'e891b93f-e7fe-48d0-9afc-8570d805ef08' // lca-db
const DRY = process.argv.includes('--dry-run')

const need = (k) => {
  const v = process.env[k]
  if (!v) { console.error(`Missing env var ${k}`); process.exit(1) }
  return v
}
const SUPABASE_URL = need('SUPABASE_URL')
const SERVICE_KEY = need('SUPABASE_SERVICE_ROLE_KEY')
const CF_TOKEN = need('CLOUDFLARE_API_TOKEN')
const CF_ACCOUNT = need('CF_ACCOUNT_ID')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    },
  )
  const json = await res.json()
  if (!json.success) throw new Error(`D1: ${JSON.stringify(json.errors)}`)
  return json.result[0]
}

// Find an existing auth user by email (createUser already failed with a
// duplicate). Pages through listUsers — fine at LCA scale.
async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

// --- read TSV ---
const lines = readFileSync(new URL('./lca-import.tsv', import.meta.url), 'utf8')
  .split('\n').map((l) => l.replace(/\r$/, '')).filter(Boolean)
const header = lines[0].split('\t')
const rows = lines.slice(1).map((l) => {
  const cells = l.split('\t')
  return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()]))
})
console.log(`${rows.length} rows loaded${DRY ? ' — DRY RUN, nothing will be written' : ''}\n`)

const summary = { created: 0, skipped: 0, failed: 0 }
const failures = []

for (const r of rows) {
  const email = r.email.toLowerCase()
  const label = `${r.full_name} <${email}>`
  try {
    // 1. idempotency: member row already in D1?
    const existing = await d1('SELECT id FROM members WHERE lower(email) = ?', [email])
    if (existing.results?.length) {
      console.log(`SKIP   ${label} — member row exists`)
      summary.skipped++
      continue
    }

    if (DRY) {
      console.log(`WOULD  ${label} — auth user + member row (${r.membership_type}, ${r.membership_status}, exp ${r.membership_expiry})`)
      summary.created++
      continue
    }

    // 2. Supabase auth user
    let uid
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: r.full_name },
    })
    if (error) {
      if (/already/i.test(error.message)) {
        const found = await findAuthUserByEmail(email)
        if (!found) throw new Error(`duplicate reported but user not found: ${error.message}`)
        uid = found.id
        console.log(`       (auth user existed, reusing uid)`)
      } else {
        throw error
      }
    } else {
      uid = data.user.id
    }

    // 3. D1 members row
    await d1(
      `INSERT INTO members (id, email, full_name, uscf_id, membership_status, membership_expiry, role, membership_type)
       VALUES (?, ?, ?, ?, ?, ?, 'member', ?)`,
      [uid, email, r.full_name, r.uscf_id || null, r.membership_status, r.membership_expiry || null, r.membership_type],
    )
    console.log(`CREATE ${label}`)
    summary.created++
  } catch (err) {
    console.error(`FAIL   ${label} — ${err.message}`)
    failures.push(label)
    summary.failed++
  }
}

console.log(`\nDone. created=${summary.created} skipped=${summary.skipped} failed=${summary.failed}`)
if (failures.length) {
  console.log('Failures (re-run the script after fixing — successful rows will be skipped):')
  failures.forEach((f) => console.log('  ' + f))
  process.exit(1)
}
