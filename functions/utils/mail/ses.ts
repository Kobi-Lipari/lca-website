// functions/utils/mail/ses.ts
//
// Amazon SES's transport: SES's v2 SendEmail over HTTPS, signed with
// Signature Version 4 by ./sigv4, from the region and through the
// configuration set below. It sends one message in one request and answers
// what Amazon said, in the seam's terms; classifyOnce in ./outcome reads the
// answer as sent, worth another try later, or never. This file and
// ./resend are the transports, and with ./sns, the check of the reports
// Amazon SNS posts back (WS16 step 8), the only files under functions/
// that name a mail service's address (test/unit/mail-one-seam.test.ts).
// It takes only types from
// ./send, so the seam and its transports never import each other when the
// code runs.
//
// - With either key missing it makes no request and answers keyMissing, so a
//   deployment without the keys, a preview or a test, sends nothing.
// - The body is made into a string once, and that one string is signed and
//   sent; the clock is read once, at the send.
// - The From line is formed as Resend's transport forms it, the display
//   name and then the address in angle brackets, so a message reads the
//   same through either service; a test send goes from the From address it
//   was given (Resend's transport alone sends a test from DEFAULT_FROM).
// - Each message is tagged with its kind and, for list mail and a test of a
//   list's mail, its list, so Amazon's reports name both.
// - A fetch that throws is not caught here: the seam reads it as a request
//   with no answer or, under the engine's rules, as the runtime's refusal of
//   an outside call past the invocation's limit, as for Resend.
// - A refusal keeps Amazon's status, its code and its words, the words cut
//   to AMAZON_WORDS_MAX characters, with the key and the signature taken out
//   should an answer ever quote them back, and any Amazon resource name and
//   account number taken out, since the words are shown to the newsletter's
//   senders and neither is anything a sender needs.

import { SENDER_NAME } from '../../../domain/mail/addresses'
import type { OutgoingMail, SendResult } from './send'
import { signAwsRequest } from './sigv4'

/**
 * Amazon's region for the site's mail: us-east-1, the WS16 plan's default for K's question 9 (Q48), which K has not
 * answered otherwise. K's to change; this line and the region in Amazon's console must agree.
 */
export const SES_REGION = 'us-east-1'

/** The configuration set every message names, which carries the bounces and spam reports to Amazon SNS (WS16 step 8). */
export const SES_CONFIGURATION_SET = 'lca-mail'

/**
 * The names of the two tags every message carries: its kind, and for list mail and a test of a list's mail, its list.
 * Amazon hands them back in each report, and the receiver of reports (./sesEvents) reads the list a spam report was
 * pressed on from the second, so both names are written here alone.
 */
export const KIND_TAG = 'kind'
export const LIST_TAG = 'list'

/** SES's v2 SendEmail, in the region above. */
const SES_ENDPOINT = `https://email.${SES_REGION}.amazonaws.com/v2/email/outbound-emails`

/** The words of a send handed to Amazon SES on a deployment without both of its keys. */
export const SES_KEY_MISSING = 'No Amazon SES key on this deployment.'

/**
 * The most characters of Amazon's own words a failure keeps, the room the newsletter's test box and its waiting line
 * give them in a few short lines: Amazon's words for a refused signature can quote a whole canonical request.
 */
export const AMAZON_WORDS_MAX = 200

/** The bindings this transport reads: the two keys, secrets of the production Pages project and of the daily-emails worker. */
export interface SesEnv {
  SES_ACCESS_KEY_ID?: string
  SES_SECRET_ACCESS_KEY?: string
}

/** What SES's v2 SendEmail takes, as this transport writes it. */
export interface SesSendEmailBody {
  FromEmailAddress: string
  Destination: { ToAddresses: string[] }
  ReplyToAddresses: string[]
  Content: {
    Simple: {
      Subject: { Data: string; Charset: 'UTF-8' }
      Body: { Html: { Data: string; Charset: 'UTF-8' }; Text?: { Data: string; Charset: 'UTF-8' } }
      Headers?: Array<{ Name: string; Value: string }>
    }
  }
  ConfigurationSetName: string
  EmailTags: Array<{ Name: string; Value: string }>
}

/** The request body for one message: its From line, its one recipient, its reply-to, its content, the set and its tags. */
export function sesBody(mail: OutgoingMail): SesSendEmailBody {
  const headers = mail.headers && mail.headers.length > 0 ? { Headers: mail.headers.map((h) => ({ Name: h.name, Value: h.value })) } : {}
  return {
    FromEmailAddress: `${mail.fromName ?? SENDER_NAME} <${mail.from}>`,
    Destination: { ToAddresses: [mail.to] },
    ReplyToAddresses: [mail.replyTo],
    Content: {
      Simple: {
        Subject: { Data: mail.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: mail.html, Charset: 'UTF-8' }, ...(mail.text ? { Text: { Data: mail.text, Charset: 'UTF-8' } } : {}) },
        ...headers,
      },
    },
    ConfigurationSetName: SES_CONFIGURATION_SET,
    EmailTags: [{ Name: KIND_TAG, Value: mail.kind ?? 'event' }, ...(mail.listId ? [{ Name: LIST_TAG, Value: mail.listId }] : [])],
  }
}

/** The body as an object, when it is one. */
function parsed(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** A code as Amazon names one: letters, digits, dots, underscores and hyphens, and no more than 64 of them. */
function asCode(text: string | undefined): string | undefined {
  const code = text?.trim()
  return code && /^[A-Za-z0-9._-]{1,64}$/.test(code) ? code : undefined
}

/**
 * Amazon's code for a refusal: from the x-amzn-errortype header, read as AWS's own clients read it, what comes before
 * its first comma and its first colon and then what follows its last '#', so a code that comes with a namespace is
 * still read; or else from the body's __type or code, after its last '#'.
 */
export function amazonCode(errorType: string | null, body: Record<string, unknown> | null): string | undefined {
  const bare = errorType?.split(',')[0].split(':')[0]
  const fromHeader = asCode(bare?.slice(bare.lastIndexOf('#') + 1))
  if (fromHeader) return fromHeader
  const type = typeof body?.__type === 'string' ? body.__type : typeof body?.code === 'string' ? body.code : undefined
  return asCode(type?.slice(type.lastIndexOf('#') + 1))
}

/** What stands in Amazon's words for one of Amazon's resource names, which holds the account number and the key's user. */
const AMAZON_RESOURCE_WORDS = 'an Amazon resource'

/** What stands in Amazon's words for twelve digits standing alone, the form of an AWS account number. */
const ACCOUNT_NUMBER_WORDS = 'an account number'

/**
 * Amazon's own words for a refusal: the body's message or Message, or, for a body that is not JSON at all, its text; on
 * one line, with the secret and the signed header taken out, every Amazon resource name (from 'arn:aws' to the next
 * space, comma, quote or the end) and every account number taken out, and cut to AMAZON_WORDS_MAX characters. The
 * words reach the newsletter's waiting line, which officers who are not LCA admins are shown, and an account number or
 * the key's user name is nothing a sender needs.
 */
export function amazonWords(text: string, body: Record<string, unknown> | null, hide: readonly string[]): string {
  const message = typeof body?.message === 'string' ? body.message : typeof body?.Message === 'string' ? body.Message : body === null ? text : ''
  let words = message
  for (const secret of hide) if (secret) words = words.split(secret).join('')
  words = words
    .replace(/arn:aws[^\s,"']*/g, AMAZON_RESOURCE_WORDS)
    .replace(/\b[0-9]{12}\b/g, ACCOUNT_NUMBER_WORDS)
    .replace(/\s+/g, ' ')
    .trim()
  return words.length > AMAZON_WORDS_MAX ? `${words.slice(0, AMAZON_WORDS_MAX).trimEnd()}...` : words
}

/** The MessageId of a 2xx answer, when its body names one. */
function messageIdOf(text: string): string | undefined {
  const id = parsed(text)?.MessageId
  return typeof id === 'string' && id !== '' ? id : undefined
}

/**
 * Sends one message through Amazon SES and says what came of it: sent, with Amazon's MessageId; keyMissing, with no
 * request, when either key is missing; or Amazon's refusal, with its status, its code and its words, marked fromSes.
 */
export async function sendThroughSes(env: SesEnv, mail: OutgoingMail): Promise<SendResult> {
  const accessKeyId = env.SES_ACCESS_KEY_ID
  const secretAccessKey = env.SES_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) return { ok: false, keyMissing: true, error: SES_KEY_MISSING }

  const body = JSON.stringify(sesBody(mail))
  const headers = await signAwsRequest({
    method: 'POST',
    url: SES_ENDPOINT,
    headers: { 'content-type': 'application/json' },
    body,
    region: SES_REGION,
    service: 'ses',
    accessKeyId,
    secretAccessKey,
    now: new Date(),
  })
  const response = await fetch(SES_ENDPOINT, { method: 'POST', headers, body })

  // A 2xx means Amazon took the message, whatever its body says or whether it can be read.
  let text = ''
  try {
    text = await response.text()
  } catch {
    // The status is the answer; the words are what is lost.
  }
  if (response.ok) {
    const providerId = messageIdOf(text)
    return providerId ? { ok: true, providerId } : { ok: true }
  }

  const answer = parsed(text)
  const code = amazonCode(response.headers.get('x-amzn-errortype'), answer)
  const signature = /Signature=([0-9a-f]+)$/.exec(headers.authorization)?.[1] ?? ''
  const words = amazonWords(text, answer, [secretAccessKey, headers.authorization, signature])
  const head = `Amazon SES ${response.status}${code ? ` ${code}` : ''}`
  return { ok: false, status: response.status, ...(code ? { code } : {}), fromSes: true, error: words ? `${head}: ${words}` : head }
}
