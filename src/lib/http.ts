// src/lib/http.ts
//
// The site's shared request helpers: authHeaders (the JSON and sign-in
// headers every call sends), handleResponse (reads an answer or throws its
// error) and ApiError, which carries the HTTP status. Every area api.ts
// imports them from here. This file imports nothing from src/areas or
// src/lib/api.ts, so no area module can import itself back through it.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts.

import { supabase } from '@/lib/supabase'

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  return headers
}

/** Carries the HTTP status so callers can tell "your session died" (401)
 *  apart from "the server broke" (5xx) and react differently. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  let data: T & { error?: string }
  try {
    data = (await response.json()) as T & { error?: string }
  } catch {
    // A non-JSON body — an HTML error page from the edge, say. Parsing it
    // blind surfaces "Unexpected token '<'" to the member, which tells them
    // nothing; the status is the part that actually matters.
    throw new ApiError(
      response.ok
        ? 'The server returned an unreadable response.'
        : `Request failed (${response.status})`,
      response.status,
    )
  }

  if (!response.ok) {
    throw new ApiError(
      data.error ?? `Request failed (${response.status})`,
      response.status,
    )
  }
  return data
}

export { authHeaders, handleResponse }
