// .github/workflows/e2e-preview.yml (K5): runs only when started by hand, and
// its first job stops the run unless every precondition box is ticked and the
// address is not the live site. The step's shell script is pulled out of the
// file and run here with each combination of inputs, so what the workflow
// does is what is tested; nothing is installed and nothing reaches a network.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { block as blockOf, fileLines, stepScript } from './helpers/workflow'

const ROOT = resolve(__dirname, '../..')
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/e2e-preview.yml'), 'utf8')
const lines = fileLines('.github/workflows/e2e-preview.yml')
const block = (header: RegExp) => blockOf(lines, header)
const SCRIPT = stepScript(lines, /name: Stop unless every precondition is confirmed/)

const ALL_CONFIRMED = {
  BASE_URL: 'https://my-branch.lca-website.pages.dev',
  PREVIEW_DATABASE: 'true',
  MIGRATED_AND_SEEDED: 'true',
  STRIPE_TEST_KEYS: 'true',
  HOUSEHOLD_CHECKOUT: 'true',
  ROUND_PUBLISHING: 'true',
}

/** Runs the workflow's script the way Actions does (bash -e) with only these inputs. */
function guard(overrides: Partial<typeof ALL_CONFIRMED> = {}) {
  const env = { PATH: process.env.PATH ?? '', ...ALL_CONFIRMED, ...overrides }
  return spawnSync('bash', ['-e', '-c', SCRIPT], { env, encoding: 'utf8' })
}

describe('when the workflow can start', () => {
  it('has no trigger except workflow_dispatch', () => {
    const on = block(/^on:\s*$/)
    const triggers = on.filter((l) => /^ {2}\S/.test(l)).map((l) => l.trim().replace(/:.*$/, ''))
    expect(triggers).toEqual(['workflow_dispatch'])
    for (const word of ['push', 'pull_request', 'pull_request_target', 'schedule', 'workflow_run', 'repository_dispatch', 'release', 'cron']) {
      expect(WORKFLOW, word).not.toMatch(new RegExp(`^\\s*(on:\\s*)?-?\\s*${word}:`, 'm'))
    }
  })

  it('asks for the preview address and each confirmation, and none is optional or ticked already', () => {
    const inputs = block(/^ {4}inputs:\s*$/)
    const names = inputs.filter((l) => /^ {6}\w/.test(l)).map((l) => l.trim().replace(/:$/, ''))
    expect(names).toEqual(['base_url', 'preview_database', 'migrated_and_seeded', 'stripe_test_keys', 'household_checkout_shipped', 'round_publishing_shipped'])
    for (const name of names) {
      const input = block(new RegExp(`^ {6}${name}:\\s*$`))
      expect(input.join('\n'), name).toMatch(/required: true/)
      if (name === 'base_url') expect(input.join('\n')).toMatch(/type: string/)
      else {
        expect(input.join('\n'), name).toMatch(/type: boolean/)
        expect(input.join('\n'), name).toMatch(/default: false/)
      }
    }
  })

  it('has read-only repository permissions', () => {
    expect(block(/^permissions:\s*$/).map((l) => l.trim()).filter(Boolean)).toEqual(['contents: read'])
  })

  it('does not run the tests until the preconditions job has passed', () => {
    const e2e = block(/^ {2}e2e:\s*$/).join('\n')
    expect(e2e).toMatch(/needs: preconditions/)
    // The check job installs nothing and uses no secret.
    const check = block(/^ {2}preconditions:\s*$/).join('\n')
    expect(check).not.toMatch(/npm ci|npm install|playwright install|secrets\./)
  })

  it('hands the test logins in only to the test step, as repository secrets', () => {
    const e2e = block(/^ {2}e2e:\s*$/).join('\n')
    const step = block(/^ +- name: End-to-end tests$/).join('\n')
    for (const key of ['E2E_GUARDIAN_EMAIL', 'E2E_GUARDIAN_PASSWORD', 'E2E_DIRECTOR_EMAIL', 'E2E_DIRECTOR_PASSWORD']) {
      expect(step, key).toContain(`${key}: \${{ secrets.${key} }}`)
    }
    expect(step).toContain('E2E_BASE_URL: ${{ inputs.base_url }}')
    expect(step).toContain('run: npm run test:e2e')
    expect(e2e.match(/secrets\./g)?.length).toBe(4)
  })
})

describe('the preconditions job', () => {
  it('passes when every box is ticked and the address is a branch preview', () => {
    const r = guard()
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toContain('Every precondition is confirmed for my-branch.lca-website.pages.dev.')
  })

  it.each([
    ['PREVIEW_DATABASE', 'the preview database id is in [env.preview]'],
    ['MIGRATED_AND_SEEDED', 'the preview database is migrated and seeded from this branch'],
    ['STRIPE_TEST_KEYS', 'the preview holds Stripe test keys, not live ones'],
    ['HOUSEHOLD_CHECKOUT', "WS06's household checkout has shipped"],
    ['ROUND_PUBLISHING', "WS07's round publishing has shipped"],
  ] as const)('stops, and says why, when only %s is not ticked', (name, reason) => {
    const r = guard({ [name]: 'false' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain(`::error::Not confirmed: ${reason}`)
    expect((r.stdout.match(/::error::/g) ?? []).length).toBe(1)
    expect(r.stdout).toContain('Stopped: nothing was run against the preview.')
    expect(r.stdout).not.toContain('Every precondition is confirmed')
  })

  it.each(['', 'True', 'TRUE', '1', 'yes', 'on', ' true', 'false'])('counts only the word true as ticked, not "%s"', (value) => {
    const r = guard({ STRIPE_TEST_KEYS: value })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('Not confirmed: the preview holds Stripe test keys')
  })

  it('names every box that is missing, not just the first', () => {
    const r = guard({ PREVIEW_DATABASE: 'false', MIGRATED_AND_SEEDED: 'false', STRIPE_TEST_KEYS: 'false', HOUSEHOLD_CHECKOUT: 'false', ROUND_PUBLISHING: 'false' })
    expect(r.status).toBe(1)
    expect((r.stdout.match(/::error::Not confirmed/g) ?? []).length).toBe(5)
  })

  it.each([
    ['https://my-branch.lca-website.pages.dev', 'my-branch.lca-website.pages.dev'],
    ['HTTPS://My-Branch.LCA-Website.Pages.Dev/tournaments?x=1', 'my-branch.lca-website.pages.dev'],
    ['http://127.0.0.1:8788/', '127.0.0.1'],
    ['https://louisianachess.org.example.net', 'louisianachess.org.example.net'],
  ])('lets the branch preview address %s through', (url, host) => {
    const r = guard({ BASE_URL: url })
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain(`for ${host}.`)
  })

  it.each([
    ['nothing', '', /No preview address was given/],
    ['the www address', 'https://www.louisianachess.org', /www\.louisianachess\.org is the live site/],
    ['the bare domain', 'https://louisianachess.org', /louisianachess\.org is the live site/],
    ['the bare domain with no scheme', 'louisianachess.org/tournaments', /louisianachess\.org is the live site/],
    ['capital letters', 'HTTPS://WWW.LOUISIANACHESS.ORG', /is the live site/],
    ['a port', 'https://www.louisianachess.org:443/login', /is the live site/],
    ['a query', 'https://www.louisianachess.org?x=1', /is the live site/],
    ['another subdomain', 'https://staging.louisianachess.org', /is the live site/],
    ['the Pages production address', 'https://lca-website.pages.dev', /lca-website\.pages\.dev is the live site/],
    ['the Pages main branch address', 'https://main.lca-website.pages.dev/', /main\.lca-website\.pages\.dev is the live site/],
    ["a single deployment's own address", 'https://1a2b3c4d.lca-website.pages.dev/', /1a2b3c4d\.lca-website\.pages\.dev is a single deployment's address/],
    ['a script address', 'javascript:alert(1)', /not a web address/],
    ['an address with a scheme that does not parse', 'https://louisianachess.org%00', /not a web address/],
  ])('stops for %s', (_name, url, message) => {
    const r = guard({ BASE_URL: url })
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(message)
    expect(r.stdout).toContain('Stopped: nothing was run against the preview.')
  })

  it('stops for the live site even when every box is ticked, and for unticked boxes with a good address', () => {
    expect(guard({ BASE_URL: 'https://www.louisianachess.org' }).status).toBe(1)
    expect(guard({ HOUSEHOLD_CHECKOUT: 'false' }).status).toBe(1)
  })

  // The first job is the early stop ("exits early ... before anything is
  // installed"). The Playwright config refuses these addresses as well, but
  // only after npm ci and the browser install, so the early stop has to
  // recognise them itself.
  it.each([
    ['a trailing dot', 'https://www.louisianachess.org./'],
    ['a user name before the host', 'https://someone@www.louisianachess.org/'],
    ['a user name and password before the host', 'https://someone:secret@louisianachess.org/'],
    ['an @ inside the password', 'https://someone:se@cret@louisianachess.org/'],
    ['a fragment', 'https://louisianachess.org#top'],
    ['two trailing dots', 'https://louisianachess.org..'],
    // The URL parser folds these to louisianachess.org as well.
    ['no slashes after the scheme', 'https:louisianachess.org'],
    ['a leading space', ' https://louisianachess.org'],
    ['an escaped dot', 'https://louisianachess%2Eorg'],
  ])('stops for the live site written with %s', (_name, url) => {
    const r = guard({ BASE_URL: url })
    expect(r.status, `the early stop let ${url} through:\n${r.stdout}`).toBe(1)
    expect(r.stdout).toContain('Stopped: nothing was run against the preview.')
  })
})
