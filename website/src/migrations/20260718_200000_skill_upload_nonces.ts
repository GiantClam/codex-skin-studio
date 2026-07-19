import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`skill_upload_nonces\` (
    \`request_id\` text PRIMARY KEY NOT NULL,
    \`created_at\` integer NOT NULL
  );`)
  await db.run(sql`CREATE INDEX \`skill_upload_nonces_created_at_idx\` ON \`skill_upload_nonces\` (\`created_at\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`skill_upload_nonces\`;`)
}
