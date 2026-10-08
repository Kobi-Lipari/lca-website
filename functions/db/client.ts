// functions/db/client.ts
//
// Drizzle on the D1 binding: `const db = getDb(env.DB)`, then
// `db.select().from(members).where(eq(members.id, id))` or the relational
// form `db.query.members.findFirst(...)`. It wraps the same binding the plain
// `env.DB.prepare()` calls use, so both can be used side by side while
// queries move over one at a time.
import { drizzle } from 'drizzle-orm/d1'
import * as relations from './relations'
import * as tables from './schema'

export const schema = { ...tables, ...relations }

export type Db = ReturnType<typeof getDb>

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}
