import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`theme_packages\` ADD \`package_kind\` text DEFAULT 'theme' NOT NULL;`)
  await db.run(sql`ALTER TABLE \`theme_packages\` ADD \`bundle_manifest\` text;`)
  await db.run(sql`ALTER TABLE \`theme_packages\` ADD \`pet_manifest\` text;`)
  await db.run(sql`ALTER TABLE \`theme_packages\` ADD \`pet_contract_version\` text;`)
  await db.run(sql`ALTER TABLE \`skins\` ADD \`package_kind\` text DEFAULT 'theme';`)
  await db.run(sql`ALTER TABLE \`skins\` ADD \`pet_id\` text;`)
  await db.run(sql`ALTER TABLE \`skins\` ADD \`pet_display_name\` text;`)
  await db.run(sql`ALTER TABLE \`skins\` ADD \`pet_contract_version\` text;`)
  await db.run(sql`ALTER TABLE \`_skins_v\` ADD \`version_package_kind\` text DEFAULT 'theme';`)
  await db.run(sql`ALTER TABLE \`_skins_v\` ADD \`version_pet_id\` text;`)
  await db.run(sql`ALTER TABLE \`_skins_v\` ADD \`version_pet_display_name\` text;`)
  await db.run(sql`ALTER TABLE \`_skins_v\` ADD \`version_pet_contract_version\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`theme_packages\` DROP COLUMN \`package_kind\`;`)
  await db.run(sql`ALTER TABLE \`theme_packages\` DROP COLUMN \`bundle_manifest\`;`)
  await db.run(sql`ALTER TABLE \`theme_packages\` DROP COLUMN \`pet_manifest\`;`)
  await db.run(sql`ALTER TABLE \`theme_packages\` DROP COLUMN \`pet_contract_version\`;`)
  await db.run(sql`ALTER TABLE \`skins\` DROP COLUMN \`package_kind\`;`)
  await db.run(sql`ALTER TABLE \`skins\` DROP COLUMN \`pet_id\`;`)
  await db.run(sql`ALTER TABLE \`skins\` DROP COLUMN \`pet_display_name\`;`)
  await db.run(sql`ALTER TABLE \`skins\` DROP COLUMN \`pet_contract_version\`;`)
  await db.run(sql`ALTER TABLE \`_skins_v\` DROP COLUMN \`version_package_kind\`;`)
  await db.run(sql`ALTER TABLE \`_skins_v\` DROP COLUMN \`version_pet_id\`;`)
  await db.run(sql`ALTER TABLE \`_skins_v\` DROP COLUMN \`version_pet_display_name\`;`)
  await db.run(sql`ALTER TABLE \`_skins_v\` DROP COLUMN \`version_pet_contract_version\`;`)
}
