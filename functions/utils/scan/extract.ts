// functions/utils/scan/extract.ts
//
// Sends one scoresheet photo to the vision model and gets back a verbatim
// transcription (SCANNER_SPEC §6).
//
// The most important rule in this file is in the prompt: the model must copy
// what is written, not what should have been written. Vision models lean hard
// towards outputting legal chess, and a model that quietly fixes "Nf6" into
// "Nf3" destroys the one thing the decoder is for, and makes it impossible to
// measure how much the decoder helps. Legality is applied later, client-side,
// by the decoder and nowhere else.

import { parseModelReply, type RawScan } from './rawScan'

/**
 * The model used for extraction. A mid-tier vision model to start; the
 * smaller one gets tried once there are real sheets to measure it on
 * (SCANNER_SPEC week 4), and only replaces this if the numbers hold.
 */
export const SCAN_MODEL = 'claude-sonnet-5'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// A 60-row sheet with alternatives comes to a few thousand tokens.
const MAX_OUTPUT_TOKENS = 8000

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp'

export const EXTRACTION_PROMPT = `You are transcribing a photo of a handwritten chess scoresheet.

The sheet is usually a US Chess (USCF) scoresheet: a header block (event, date, round, board, the White and Black player names and ratings, the result), then numbered rows. Each row has a White move and a Black move. Sheets usually have 50 or 60 rows, sometimes in two side-by-side columns.

TRANSCRIBE VERBATIM. Copy exactly what is written, character by character. Do not correct chess mistakes. Do not work out what move the player meant. Do not convert between notation styles. If a move looks wrong, impossible or illegal, write it down exactly as it appears anyway. Another program checks legality later, and it can only do that if you give it the real handwriting.

For each move cell:
- "raw": your single best literal reading of the characters.
- "alts": other plausible literal readings of the whole cell when a character is ambiguous (for example "Nf3" might also read "Nf5" or "Hf3"). Leave it out when the reading is clear.
- "confidence": "high", "medium" or "low". Be honest; low is useful information.
- "struck": true if the move is crossed out or overwritten. Give the final, non-crossed-out text as "raw" if there is any.
- A blank cell is null. Players often stop writing near the end of a game, so trailing blank cells are normal.

Ignore clock times, doodles, stamps and other marks in the margins. Mention anything notable (a crossed-out row, an arrow, "continued on back", moves written outside the grid) in "sheetNotes".

If the image is not a chess scoresheet, or is too blurry or dark to read, set header.legibility to "unreadable", return an empty rows array, and say why in sheetNotes.

Reminder: verbatim. Never fix a move. Transcribe what is on the paper, even if it is not a legal chess move.

Reply with one JSON object and nothing else: no markdown, no code fences, no commentary. Use exactly this shape, leaving out header fields that are not on the sheet:

{
  "header": {
    "event": string, "date": string, "round": string, "board": string,
    "whiteName": string, "blackName": string,
    "whiteRating": string, "blackRating": string,
    "result": string, "timeControl": string,
    "legibility": "clear" | "partial" | "unreadable"
  },
  "rows": [
    { "n": 1, "white": { "raw": "e4", "confidence": "high" }, "black": { "raw": "e5", "alts": ["c5"], "confidence": "medium" } }
  ],
  "sheetNotes": [string]
}`

export type ExtractResult =
  | { kind: 'ok'; scan: RawScan; usage: { inputTokens: number; outputTokens: number } }
  /** The model service refused or failed; status is what it returned. */
  | { kind: 'upstream'; status: number; detail: string }
  /** The model answered, but not with anything that parses as a scan. */
  | { kind: 'malformed'; reason: string; sample: string }

/** Base64 without blowing the stack on a multi-megabyte image. */
export function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

interface MessagesResponse {
  stop_reason?: string
  content?: Array<{ type: string; text?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
}

/**
 * The model service's own explanation of a refusal ("credit balance too
 * low", "model not found", an invalid parameter). Without it the logs only
 * say "400", which could be any of a dozen causes. Never contains the key:
 * the service does not echo request headers back.
 */
async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { type?: string; message?: string } }
    const { type, message } = body.error ?? {}
    return [type, message].filter(Boolean).join(': ').slice(0, 500) || 'no error message'
  } catch {
    return 'non-JSON error response'
  }
}

export async function extractRawScan(
  apiKey: string,
  image: ArrayBuffer,
  mediaType: ImageMediaType,
): Promise<ExtractResult> {
  let response: Response
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: SCAN_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Transcription, not creativity. Zero keeps repeat scans of the same
        // photo as close to identical as the model allows.
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: toBase64(image) },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    })
  } catch {
    // Network failure before any status came back.
    return { kind: 'upstream', status: 0, detail: 'network error before any response' }
  }

  if (!response.ok) {
    return { kind: 'upstream', status: response.status, detail: await errorDetail(response) }
  }

  let body: MessagesResponse
  try {
    body = (await response.json()) as MessagesResponse
  } catch {
    return { kind: 'malformed', reason: 'model service returned non-JSON', sample: '' }
  }

  const reply = (body.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')

  const parsed = parseModelReply(reply)
  if (!parsed.ok) {
    return {
      kind: 'malformed',
      reason: `${parsed.reason} (stop_reason: ${body.stop_reason ?? 'unknown'}, ${reply.length} chars)`,
      sample: reply.slice(0, 300),
    }
  }

  return {
    kind: 'ok',
    scan: parsed.scan,
    usage: {
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
    },
  }
}
