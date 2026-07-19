import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`download_grants\` (
    \`nonce\` text PRIMARY KEY NOT NULL,
    \`slug\` text NOT NULL,
    \`package_sha256\` text NOT NULL,
    \`expires_at\` integer NOT NULL,
    \`used_at\` integer
  );`)
  await db.run(sql`CREATE INDEX \`download_grants_expires_at_idx\` ON \`download_grants\` (\`expires_at\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`download_grants\`;`)
}
