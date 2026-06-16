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