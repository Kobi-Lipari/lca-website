// drizzle.config.ts
//
// drizzle-kit settings. The schema lives in functions/db/schema.ts. drizzle-kit
// writes into drizzle/, a staging folder, never into migrations/: run
// `npm run db:generate -- <name>`, which numbers the new file after the last
// one in migrations/, checks it and moves it there, so wrangler, the
// production migrate workflow and the test setup keep reading migrations/
// exactly as before. drizzle/meta holds the snapshots drizzle-kit diffs
// against and is committed. See migrations/README.md.
//
// `drizzle-kit pull` reads the local file built by `npm run db:local-sqlite`
// (every migration applied in order), never a remote database.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './functions/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: 'file:.drizzle/introspect.sqlite' },
  // D1's migration log, Cloudflare's internal tables and SQLite's own.
  tablesFilter: ['!d1_migrations', '!_cf_*', '!sqlite_*'],
})
