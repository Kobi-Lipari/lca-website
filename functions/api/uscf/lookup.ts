// functions/api/uscf/lookup.ts
import { fetchUscfById } from '../../utils/uscf'
import { jsonResponse, errorResponse } from '../../utils/response'
import type { Env } from '../../types'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const id = url.searchParams.get('id')?.trim()

  if (!id || !/^\d+$/.test(id)) {
    return errorResponse('Valid numeric USCF ID required', 400)
  }

  const { player, scraperDown } = await fetchUscfById(id)

  if (scraperDown) {
    return jsonResponse({ scraperDown: true, player: null }, 503)
  }

  return jsonResponse({ scraperDown: false, player })
}