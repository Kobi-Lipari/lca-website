// functions/api/search.ts
//
// GET /api/search?q= (WS02 step 9): the site's search, public, answering
// brief 1.4's SearchResponse (domain/contracts/search.ts). What it reads,
// how it matches and how the answer is kept at the edge are in
// functions/utils/search.ts; this file is the page alone. No page asks it
// anything until the Search button and the panel come with WS02 step 10.
import type { Env } from '../types'
import { handleOptions } from '../utils/response'
import { answerSearch, edgeCache } from '../utils/search'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = (context) => answerSearch(context, edgeCache())
