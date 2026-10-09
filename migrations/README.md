# Database migrations

Applied automatically to the live D1 database when a PR merges to `main`
(`.github/workflows/migrate-db.yml`), and in order to the test database
before the integration tests run.

## Never rebuild a table other tables cascade from (or restore them)

SQLite can't change a column or CHECK constraint in place, so the usual
fix is "copy, DROP TABLE, CREATE, copy back". **Don't do that to a table
that others reference with `ON DELETE CASCADE` or `ON DELETE SET NULL`**
(today: `members` and `tournaments`, among others).

`DROP TABLE` deletes every row first, and with foreign keys on (D1 always
has them on) that fires the cascade: the child rows are deleted, or their
link set to NULL. `PRAGMA defer_foreign_keys = true` only postpones the
*checks*; it does **not** stop cascades. Migrations 0019, 0033 and 0040 did
exactly this and silently emptied board seat assignments, tournament
director assignments and reminders.

Prefer, in order:

1. `ALTER TABLE ... ADD COLUMN` / `DROP COLUMN` / `RENAME COLUMN`. These
   never delete rows.
2. Enforce allowed values with triggers instead of CHECK constraints (see
   0046), so changing the list is `DROP TRIGGER` + `CREATE TRIGGER`.
3. If a rebuild is truly needed, do it like 0046: copy every child table
   (`CREATE TABLE keep_x AS SELECT * FROM x`) before the DROP, and put the
   rows back (`INSERT INTO x SELECT * FROM keep_x`, or an `UPDATE` for SET
   NULL links) in the same migration.

`test/unit/migration-safety.test.ts` fails CI for any migration that drops
a parent table without restoring its children. It reads hand-written SQL and
drizzle-kit's style alike (names in backticks or double quotes, `ON UPDATE`
before `ON DELETE`, `ADD` without `COLUMN`).

## Writing a migration with Drizzle

`functions/db/schema.ts` describes the database for Drizzle. The files in
this folder stay the source of truth: wrangler, `migrate-db.yml` and the
integration test setup read `migrations/*.sql` exactly as before, and
`test/unit/schema-drift.test.ts` fails when `schema.ts` and the migrations
disagree on a table, column, index or foreign key.

To change the schema:

1. Edit `functions/db/schema.ts`.
2. Run `npm run db:generate -- <name>` (for example
   `npm run db:generate -- club notes`). drizzle-kit writes its file into
   the staging folder `drizzle/`; the script numbers it after the highest
   prefix here (the sections tables were `0052`; `0054` is next), adds a
   header and writes it here as `0054_club_notes.sql`. Commit it together
   with the new snapshot in `drizzle/meta`.
3. Read the file, run `npm run db:migrate:local` and `npm run test:all`.

The script refuses, writes nothing and puts `drizzle/` back when the file
would contain `DROP TABLE`, a `__new_` table or `PRAGMA foreign_keys`. That
is drizzle-kit rebuilding a table to add or change a constraint, which is
the cascade trap above, and `PRAGMA foreign_keys` cannot switch foreign keys
off in a D1 migration. It also refuses a column added with `REFERENCES` when
drizzle-kit leaves out the `ON DELETE` or `ON UPDATE` action the schema asks
for (drizzle-kit 0.31 does this for `ALTER TABLE ... ADD`).

When a column or table goes and another arrives, drizzle-kit asks whether
it was renamed. Run `db:generate` in a terminal so it can ask. Without one
(CI, a pipe) drizzle-kit cannot ask and prints an `Error:` line; the script
then stops and writes nothing rather than reporting "no schema changes".

For those changes, and for data migrations, run
`npm run db:generate -- <name> --custom`. It writes a numbered file with a
header for you to fill in; if the schema changed, drizzle-kit's own version is
included as comments to work from, and `drizzle/meta` records the new schema
so the next run does not offer the same change again. Write it the safe way
(the list above), then run the tests.

### What stays hand-written

- **Triggers.** Drizzle does not model triggers, so they live only in
  migrations (today `members_role_insert` and `members_role_update`, from
  0046 and 0050, and the four sections and schedules triggers from 0053,
  which keep `tournament_sections`, `tournament_schedules` and their rounds
  in step with the JSON columns). Write them in a `--custom` migration.
- **CHECK constraints and inline `UNIQUE` constraints.** They are in the
  migrations but not in `schema.ts` (its header says why). Changing one means
  rebuilding a table; follow the rules above.
- **Anything `db:generate` refuses.**

### Rebuilding the introspection database

`npm run db:local-sqlite` applies every migration in filename order to
`.drizzle/introspect.sqlite` (gitignored), with foreign keys on as on D1. It
is what `drizzle-kit pull` read to write the first `schema.ts`; it never
touches a remote database. Do not run `drizzle-kit pull` again over
`drizzle/`: it would replace the reviewed schema and the baseline snapshot.

## Recovering data

D1 keeps a point-in-time history (Time Travel): 30 days on the Workers Paid plan, 7 on Free:
`wrangler d1 time-travel info lca-db --timestamp=<ISO time>` and
`wrangler d1 time-travel restore`. A restore replaces the whole database,
so everything written since is lost unless copied out first.
