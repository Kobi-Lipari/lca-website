// test/integration/contracts/ses-events.test.ts
//
// POST /api/mail/ses-events, the receiver of Amazon's reports (WS16 step
// 8), to its contract in domain/contracts/mail.ts: its 200, for a
// notification that writes, one that changes nothing and a confirmation,
// is { received: true } and nothing more; and its 404, its 400 and its 500
// answer the shared error body. SNS's body is not held to a request schema,
// as Stripe's webhook's is not. Each message is signed by
// test/integration/helpers/sns.ts under a key made for the test run, and
// the harness's SNS catch point serves its certificate. MAIL_LISTS_ON and
// the other constants are read through getters on the mocked switches
// module, set before every case.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../../domain/contracts'
import { onRequestPost } from '../../../functions/api/mail/ses-events'
import { expectContract, invoke, resetHarness, snsBehavior } from '../harness'
import { makeSigner, sesBounce, sesOther, snsRequest, type SnsSigner } from '../helpers/sns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
    get WORKERS_PLAN() {
      return flags.plan
    },
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

const received = contracts['mail/ses-events'].POST

let signer: SnsSigner
let seq = 0
const notify = (event: unknown) => signer.sign({ Subject: 'Amazon SES Email Event Notification', Message: JSON.stringify(event) })

beforeAll(async () => {
  signer = await makeSigner()
})

beforeEach(() => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  snsBehavior.certificate = signer.pem
})

describe('POST /api/mail/ses-events', () => {
  it('answers a notification that writes, one that changes nothing and a confirmation to its contract, { received: true } and nothing more', async () => {
    for (const message of [
      await notify(sesBounce([`contract-${++seq}@example.org`])), await notify(sesOther([`contract-${++seq}@example.org`])), await signer.sign({ Type: 'SubscriptionConfirmation' }),
    ]) {
      const res = await invoke(onRequestPost, snsRequest(message))
      expect(res.status).toBe(200)
      expect(await expectContract(res, received.response)).toEqual({ received: true })
    }
    expect(received).not.toHaveProperty('request')
  })

  it('answers its 404 while the rules are off, its 400 for a message it does not take and its 500 for a certificate it cannot fetch with the shared error body', async () => {
    flags.listsOn = false
    const off = await invoke(onRequestPost, snsRequest(await notify(sesBounce([`contract-${++seq}@example.org`]))))
    expect(off.status).toBe(404)
    expect(await expectContract(off, errorBodySchema)).toEqual({ error: 'Not found' })
    flags.listsOn = true
    const forged = await invoke(onRequestPost, snsRequest(await signer.forge({ Message: '{}' })))
    expect(forged.status).toBe(400)
    await expectContract(forged, errorBodySchema)
    snsBehavior.certReachable = false
    const unreachable = await invoke(onRequestPost, snsRequest(await notify(sesBounce([`contract-${++seq}@example.org`]))))
    expect(unreachable.status).toBe(500)
    await expectContract(unreachable, errorBodySchema)
  })
})
