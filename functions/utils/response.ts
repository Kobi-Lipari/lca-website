import type { output, ZodType } from 'zod'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status)
}

export function handleOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export function parseJsonBody<T>(request: Request): Promise<T | null> {
  return request.json().catch(() => null) as Promise<T | null>
}

/**
 * Reads a JSON body and checks it against its contract (domain/contracts).
 *
 * Returns the parsed body, or a 400 to return as is: the usual { error }
 * plus `fields`, one plain message per field that failed, keyed by its path
 * ("sections.0.entryFee"; "body" for the body as a whole). Request schemas
 * describe what the handler already accepts, with unknown keys passed
 * through, so switching a handler from parseJsonBody rejects nothing the
 * site sends today.
 *
 * Only the schema's own safeParse runs here, so this file needs zod's types
 * and not zod itself.
 */
export async function parseBody<S extends ZodType>(
  request: Request,
  schema: S,
): Promise<output<S> | Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', fields: { body: 'The body is not valid JSON.' } }, 400)
  }
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data
  const fields: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join('.') || 'body'
    fields[key] ??= issue.message
  }
  return jsonResponse({ error: 'Some fields are missing or not valid.', fields }, 400)
}
