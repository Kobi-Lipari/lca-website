export const meta = {
  name: 'build-slice',
  description: 'Build one or more workstream slices in order: scout the code, build, test, review with a fix loop, then record the outcome',
  whenToUse: 'A coding task from the redesign brief with a clear scope and acceptance criteria. Pass args: { slices: [{ name, brief, files, acceptance }], base?: "main" }',
  phases: [
    { title: 'Scout', detail: 'resolve the verify: items and locate the code' },
    { title: 'Build', detail: 'implement the slice and run the gate' },
    { title: 'Test', detail: 'cover the acceptance criteria' },
    { title: 'Review', detail: 'adversarial review, fix loop up to two rounds' },
    { title: 'Record', detail: 'REDESIGN_STATUS.md and the commit text' },
  ],
}

const slices = (args && args.slices) || []
const base = (args && args.base) || 'main'
if (!slices.length) throw new Error('build-slice needs args.slices')

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocking', 'should-fix', 'nit'] },
          file: { type: 'string' }, line: { type: 'number' },
          problem: { type: 'string' }, scenario: { type: 'string' }, fix: { type: 'string' },
        },
        required: ['severity', 'file', 'problem', 'scenario', 'fix'],
      },
    },
    verdict: { type: 'string' },
  },
  required: ['findings', 'verdict'],
}

const results = []
// Slices run one after another: they share one working tree.
for (const s of slices) {
  const scope = `Slice: ${s.name}\nBrief: ${s.brief}\nFiles in scope: ${(s.files || []).join(', ') || 'as the brief names'}\nAcceptance criteria:\n${(s.acceptance || []).map((a, i) => `${i + 1}. ${a}`).join('\n')}`

  const facts = await agent(`${scope}\n\nFind and report every fact a builder needs before touching this slice: where each file and helper named in the brief lives today (or that it does not exist), the current shape of every table, endpoint, response and test harness it touches, and the answer to every "verify:" item in the brief's section for this slice. Paths and line numbers.`,
    { label: `scout:${s.name}`, phase: 'Scout', agentType: 'scout' })

  const build = await agent(`${scope}\n\nFacts from the scout:\n${facts}\n\nImplement the slice completely, then run the gate (lint, build, typecheck:functions, test:all) and fix what it finds. Do not commit.`,
    { label: `build:${s.name}`, phase: 'Build', agentType: 'builder' })

  const tests = await agent(`${scope}\n\nThe builder reported:\n${build}\n\nCover every acceptance criterion with tests that do not yet exist, run the suites, fix test-only problems, and report any defect a test reveals in the code.`,
    { label: `test:${s.name}`, phase: 'Test', agentType: 'tester' })

  let round = 0, review = null, fixes = []
  while (round < 3) {
    review = await agent(`${scope}\n\nReview the working tree's changes against ${base} (run: git diff ${base} --stat, then read the changed files). Builder report:\n${build}\nTester report:\n${tests}\n${fixes.length ? `Fixes applied since the last review:\n${fixes.join('\n\n')}` : ''}\n\nReport findings as structured output; verdict is "ready" when nothing blocking remains.`,
      { label: `review:${s.name}:${round + 1}`, phase: 'Review', agentType: 'reviewer', schema: FINDINGS })
    const blocking = (review && review.findings || []).filter(f => f.severity !== 'nit')
    if (!blocking.length) break
    round += 1
    const fix = await agent(`${scope}\n\nA reviewer found these problems in the working tree; fix each one (or explain precisely why it is not a defect), then re-run the gate:\n${JSON.stringify(blocking, null, 2)}`,
      { label: `fix:${s.name}:${round}`, phase: 'Review', agentType: 'builder' })
    fixes.push(fix)
  }
  if (round >= 3) log(`${s.name}: three fix rounds used; remaining findings go to the lead`)

  const record = await agent(`${scope}\n\nThe slice is built. Builder report:\n${build}\nTester report:\n${tests}\nFinal review:\n${JSON.stringify(review)}\nFixes:\n${fixes.join('\n\n')}\n\nUpdate REDESIGN_STATUS.md (create it if missing) and any flag comments, and draft the commit message. Do not commit.`,
    { label: `record:${s.name}`, phase: 'Record', agentType: 'recorder' })

  results.push({ slice: s.name, facts, build, tests, review, fixes, record })
}

return results
