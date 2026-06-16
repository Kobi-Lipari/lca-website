import type { Env } from '../types'
import { jsonResponse } from '../utils/response'

export const onRequestGet: PagesFunction<Env> = async () => {
  return jsonResponse({ status: 'ok', service: 'lca-api' })
}
