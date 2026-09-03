// functions/api/uscf/lookup.ts
import { fetchUscfById, isValidUscfId } from '../../utils/uscf'
import { jsonResponse, errorResponse } from '../../utils/response'
import type { Env } from '../../types'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const id = url.searchParams.get('id')?.trim()

  // US Chess ids are 8 digits. Checking the shape here means a typo comes
  // back as a clear 400 instead of an upstream round trip and a vague miss.
  if (!isValidUscfId(id)) {
    return errorResponse('A valid 8-digit USCF ID is required', 400)
  }

  const { player, upstreamUnavailable } = await fetchUscfById(id as string)

  if (upstreamUnavailable) {
    return jsonResponse({ upstreamUnavailable: true, player: null }, 503)
  }

  return jsonResponse({ upstreamUnavailable: false, player })
}
