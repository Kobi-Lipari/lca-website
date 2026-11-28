// The projects and servers of playwright.config.ts once the clubs build is
// a third (WS09 step 24, the browser half), read by importing the config as
// the browser runner does and asking which spec files each project would
// run and which servers a run starts:
//
// - the clubs pages' own spec files (test/a11y/clubs-*.spec.ts) are run by
//   the a11y-clubs project and by neither of the two builds, so each of the
//   two runs exactly the specs it ran before
// - every other spec file is run by both a11y-on and a11y-off and never by
//   a11y-clubs, and the recorded baseline (baseline.ts) by a11y-off alone
// - a run of the two projects alone starts the same two servers as before,
//   on ports 8801 and 8802; a run that names the clubs project adds the third,
//   on 8803, from the copy of functions/ the setup makes, with the same
//   bindings as the other two and the same environment, none of it the
//   shell's
// Nothing here starts a server or a browser.
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { A11Y_CLUBS_SERVER, A11Y_SERVER_ENV, a11yServerArgs } from '../a11y/global-setup'

const ROOT = resolve(__dirname, '../..')
const A11Y = join(ROOT, 'test/a11y')

interface Project {
  name: string
  testDir?: string
  testMatch?: RegExp[]
  testIgnore?: RegExp[]
  use?: { baseURL?: string }
}
interface Server {
  command: string
  url: string
  cwd: string
  env: Record<string, string>
}
interface Config {
  projects: Project[]
  webServer: Server[]
}

const saved = process.env.LCA_PW_PROJECTS
beforeEach(() => vi.resetModules())
afterEach(() => {
  if (saved === undefined) delete process.env.LCA_PW_PROJECTS
  else process.env.LCA_PW_PROJECTS = saved
})

/** The config as a run that names these projects loads it. */
async function configFor(projects: string): Promise<Config> {
  process.env.LCA_PW_PROJECTS = projects
  return (await import('../../playwright.config')).default as unknown as Config
}

/** True when the project would run the file: matched by testMatch and not by testIgnore. */
const runs = (project: Project, file: string) =>
  (project.testMatch ?? []).some((re) => re.test(file)) && !(project.testIgnore ?? []).some((re) => re.test(file))

const files = readdirSync(A11Y).filter((f) => /\.ts$/.test(f)).map((f) => join(A11Y, f))
const specs = files.filter((f) => /\.spec\.ts$/.test(f))
const clubsSpecs = specs.filter((f) => /clubs-[^/]*\.spec\.ts$/.test(f))

describe('which project runs which file', () => {
  it('has the clubs pages\' own spec files, and they are the only files the clubs project runs', async () => {
    const { projects } = await configFor('a11y-on,a11y-off,a11y-clubs')
    expect(projects.map((p) => p.name).filter((n) => n.startsWith('a11y'))).toEqual(['a11y-on', 'a11y-off', 'a11y-clubs'])
    expect(clubsSpecs.length).toBeGreaterThanOrEqual(2)
    const clubs = projects.find((p) => p.name === 'a11y-clubs')!
    expect(files.filter((f) => runs(clubs, f))).toEqual(clubsSpecs)
  })

  it('keeps every clubs spec out of a11y-on and a11y-off, and every other spec in both', async () => {
    const { projects } = await configFor('a11y-on,a11y-off,a11y-clubs')
    for (const name of ['a11y-on', 'a11y-off']) {
      const project = projects.find((p) => p.name === name)!
      for (const file of clubsSpecs) expect(runs(project, file), `${name} runs ${file}`).toBe(false)
      for (const file of specs.filter((f) => !clubsSpecs.includes(f))) expect(runs(project, file), `${name} skips ${file}`).toBe(true)
    }
  })

  it('runs the recorded baseline in a11y-off alone', async () => {
    const { projects } = await configFor('a11y-on,a11y-off,a11y-clubs')
    const baseline = join(A11Y, 'baseline.ts')
    expect(projects.filter((p) => runs(p, baseline)).map((p) => p.name)).toEqual(['a11y-off'])
  })

  it('points each project at its own server', async () => {
    const { projects } = await configFor('a11y-on,a11y-off,a11y-clubs')
    const urls = Object.fromEntries(projects.filter((p) => p.name.startsWith('a11y')).map((p) => [p.name, p.use?.baseURL]))
    expect(urls).toEqual({ 'a11y-on': 'http://127.0.0.1:8801', 'a11y-off': 'http://127.0.0.1:8802', 'a11y-clubs': 'http://127.0.0.1:8803' })
  })
})

describe('which servers a run starts', () => {
  it('starts the two servers of the two builds, as before, when only the two are asked for', async () => {
    const { webServer } = await configFor('a11y-on,a11y-off')
    expect(webServer.map((s) => s.url)).toEqual(['http://127.0.0.1:8801/', 'http://127.0.0.1:8802/'])
    for (const server of webServer) expect(server.cwd).toBe(ROOT)
  })

  it('adds the clubs server, from its copy of functions/, when the clubs project is asked for', async () => {
    const { webServer } = await configFor('a11y-on,a11y-off,a11y-clubs')
    expect(webServer.map((s) => s.url)).toEqual(['http://127.0.0.1:8801/', 'http://127.0.0.1:8802/', 'http://127.0.0.1:8803/'])
    const clubs = webServer[2]
    expect(clubs.cwd).toBe(join(ROOT, A11Y_CLUBS_SERVER))
    expect(clubs.command).toContain(`--port 8803 --inspector-port 9233`)
    expect(clubs.command).toContain(`${join(ROOT, 'dist-a11y-clubs')} `)
    expect(clubs.command).toContain(`--persist-to ${join(ROOT, '.wrangler/a11y/clubs')} `)
  })

  it('binds the same variables to all three servers, and takes none from the shell', async () => {
    const { webServer } = await configFor('a11y-on,a11y-off,a11y-clubs')
    const bound = a11yServerArgs().join(' ')
    for (const server of webServer) {
      expect(server.command.endsWith(bound), server.url).toBe(true)
      expect(server.env).toEqual(A11Y_SERVER_ENV)
    }
    expect(A11Y_SERVER_ENV.CLOUDFLARE_INCLUDE_PROCESS_ENV).toBe('false')
  })
})
