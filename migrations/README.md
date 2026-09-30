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
a parent table without restoring its children.

## Recovering data

D1 keeps a point-in-time history (Time Travel): 30 days on the Workers Paid plan, 7 on Free:
`wrangler d1 time-travel info lca-db --timestamp=<ISO time>` and
`wrangler d1 time-travel restore`. A restore replaces the whole database,
so everything written since is lost unless copied out first.
