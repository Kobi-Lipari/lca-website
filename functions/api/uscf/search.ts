// functions/api/uscf/search.ts
import { searchUscfByName } from '../../utils/uscf'
import { jsonResponse, errorResponse } from '../../utils/response'
import type { Env } from '../../types'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const lastName = url.searchParams.get('lastName')?.trim()
  const firstName = url.searchParams.get('firstName')?.trim()

  if (!lastName || lastName.length < 2) {
    return errorResponse('Last name required (min 2 characters)', 400)
  }

  const result = await searchUscfByName(lastName, firstName || undefined)

  return jsonResponse(result, result.scraperDown ? 503 : 200)
}