import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`role\` text DEFAULT 'reviewer' NOT NULL,
  	\`active\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`alt\` text,
  	\`is_public\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric,
  	\`sizes_card_url\` text,
  	\`sizes_card_width\` numeric,
  	\`sizes_card_height\` numeric,
  	\`sizes_card_mime_type\` text,
  	\`sizes_card_filesize\` numeric,
  	\`sizes_card_filename\` text,
  	\`sizes_thumb_url\` text,
  	\`sizes_thumb_width\` numeric,
  	\`sizes_thumb_height\` numeric,
  	\`sizes_thumb_mime_type\` text,
  	\`sizes_thumb_filesize\` numeric,
  	\`sizes_thumb_filename\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_card_sizes_card_filename_idx\` ON \`media\` (\`sizes_card_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_sizes_thumb_sizes_thumb_filename_idx\` ON \`media\` (\`sizes_thumb_filename\`);`)
  await db.run(sql`CREATE TABLE \`theme_packages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`original_filename\` text,
  	\`sha256\` text NOT NULL,
  	\`r2_object_key\` text,
  	\`validator_version\` text NOT NULL,
  	\`validation_status\` text DEFAULT 'pending' NOT NULL,
  	\`validation_report\` text,
  	\`manifest\` text,
  	\`uploaded_by_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric,
  	FOREIGN KEY (\`uploaded_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`theme_packages_uploaded_by_idx\` ON \`theme_packages\` (\`uploaded_by_id\`);`)
  await db.run(sql`CREATE INDEX \`theme_packages_updated_at_idx\` ON \`theme_packages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`theme_packages_created_at_idx\` ON \`theme_packages\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`theme_packages_filename_idx\` ON \`theme_packages\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`skins_targets\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`skins\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`skins_targets_order_idx\` ON \`skins_targets\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`skins_targets_parent_idx\` ON \`skins_targets\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`skins_categories\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`skins\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`skins_categories_order_idx\` ON \`skins_categories\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`skins_categories_parent_idx\` ON \`skins_categories\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`skins_palette\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`skins\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`skins_palette_order_idx\` ON \`skins_palette\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`skins_palette_parent_idx\` ON \`skins_palette\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`skins\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`slug\` text,
  	\`summary\` text,
  	\`description\` text,
  	\`status\` text DEFAULT 'draft',
  	\`version\` text,
  	\`hero_id\` integer,
  	\`logo_id\` integer,
  	\`polaroid_id\` integer,
  	\`package_id\` integer,
  	\`author_display_name\` text,
  	\`art\` text DEFAULT 'paper',
  	\`source_type\` text DEFAULT 'manual',
  	\`source_url\` text,
  	\`license\` text,
  	\`downloads\` numeric DEFAULT 0,
  	\`review_note\` text,
  	\`reviewed_by_id\` integer,
  	\`reviewed_at\` text,
  	\`published_at\` text,
  	\`rejection_reason\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`hero_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`polaroid_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`package_id\`) REFERENCES \`theme_packages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reviewed_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`skins_slug_idx\` ON \`skins\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`skins_hero_idx\` ON \`skins\` (\`hero_id\`);`)
  await db.run(sql`CREATE INDEX \`skins_logo_idx\` ON \`skins\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`skins_polaroid_idx\` ON \`skins\` (\`polaroid_id\`);`)
  await db.run(sql`CREATE INDEX \`skins_package_idx\` ON \`skins\` (\`package_id\`);`)
  await db.run(sql`CREATE INDEX \`skins_reviewed_by_idx\` ON \`skins\` (\`reviewed_by_id\`);`)
  await db.run(sql`CREATE INDEX \`skins_updated_at_idx\` ON \`skins\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`skins_created_at_idx\` ON \`skins\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`skins__status_idx\` ON \`skins\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_skins_v_version_targets\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_skins_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_skins_v_version_targets_order_idx\` ON \`_skins_v_version_targets\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_targets_parent_idx\` ON \`_skins_v_version_targets\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_skins_v_version_categories\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_skins_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_skins_v_version_categories_order_idx\` ON \`_skins_v_version_categories\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_categories_parent_idx\` ON \`_skins_v_version_categories\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_skins_v_version_palette\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_skins_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_skins_v_version_palette_order_idx\` ON \`_skins_v_version_palette\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_palette_parent_idx\` ON \`_skins_v_version_palette\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_skins_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_slug\` text,
  	\`version_summary\` text,
  	\`version_description\` text,
  	\`version_status\` text DEFAULT 'draft',
  	\`version_version\` text,
  	\`version_hero_id\` integer,
  	\`version_logo_id\` integer,
  	\`version_polaroid_id\` integer,
  	\`version_package_id\` integer,
  	\`version_author_display_name\` text,
  	\`version_art\` text DEFAULT 'paper',
  	\`version_source_type\` text DEFAULT 'manual',
  	\`version_source_url\` text,
  	\`version_license\` text,
  	\`version_downloads\` numeric DEFAULT 0,
  	\`version_review_note\` text,
  	\`version_reviewed_by_id\` integer,
  	\`version_reviewed_at\` text,
  	\`version_published_at\` text,
  	\`version_rejection_reason\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`skins\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_polaroid_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_package_id\`) REFERENCES \`theme_packages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_reviewed_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_skins_v_parent_idx\` ON \`_skins_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version_slug_idx\` ON \`_skins_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version_hero_idx\` ON \`_skins_v\` (\`version_hero_id\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version_logo_idx\` ON \`_skins_v\` (\`version_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version_polaroid_idx\` ON \`_skins_v\` (\`version_polaroid_id\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version_package_idx\` ON \`_skins_v\` (\`version_package_id\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version_reviewed_by_idx\` ON \`_skins_v\` (\`version_reviewed_by_id\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version_updated_at_idx\` ON \`_skins_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version_created_at_idx\` ON \`_skins_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_version_version__status_idx\` ON \`_skins_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_created_at_idx\` ON \`_skins_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_updated_at_idx\` ON \`_skins_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_skins_v_latest_idx\` ON \`_skins_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`github_sources\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`repository_url\` text NOT NULL,
  	\`owner\` text NOT NULL,
  	\`repository\` text NOT NULL,
  	\`default_branch\` text,
  	\`license_spdx_id\` text,
  	\`stars\` numeric,
  	\`source_snapshot_url\` text,
  	\`matched_files\` text,
  	\`notes\` text,
  	\`status\` text DEFAULT 'found',
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`github_sources_updated_at_idx\` ON \`github_sources\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`github_sources_created_at_idx\` ON \`github_sources\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`moderation_logs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`skin_id\` integer NOT NULL,
  	\`actor_id\` integer NOT NULL,
  	\`action\` text NOT NULL,
  	\`note\` text,
  	\`validation_report\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`skin_id\`) REFERENCES \`skins\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`actor_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`moderation_logs_skin_idx\` ON \`moderation_logs\` (\`skin_id\`);`)
  await db.run(sql`CREATE INDEX \`moderation_logs_actor_idx\` ON \`moderation_logs\` (\`actor_id\`);`)
  await db.run(sql`CREATE INDEX \`moderation_logs_updated_at_idx\` ON \`moderation_logs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`moderation_logs_created_at_idx\` ON \`moderation_logs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	\`theme_packages_id\` integer,
  	\`skins_id\` integer,
  	\`github_sources_id\` integer,
  	\`moderation_logs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`theme_packages_id\`) REFERENCES \`theme_packages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`skins_id\`) REFERENCES \`skins\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`github_sources_id\`) REFERENCES \`github_sources\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`moderation_logs_id\`) REFERENCES \`moderation_logs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_theme_packages_id_idx\` ON \`payload_locked_documents_rels\` (\`theme_packages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_skins_id_idx\` ON \`payload_locked_documents_rels\` (\`skins_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_github_sources_id_idx\` ON \`payload_locked_documents_rels\` (\`github_sources_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_moderation_logs_id_idx\` ON \`payload_locked_documents_rels\` (\`moderation_logs_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`theme_packages\`;`)
  await db.run(sql`DROP TABLE \`skins_targets\`;`)
  await db.run(sql`DROP TABLE \`skins_categories\`;`)
  await db.run(sql`DROP TABLE \`skins_palette\`;`)
  await db.run(sql`DROP TABLE \`skins\`;`)
  await db.run(sql`DROP TABLE \`_skins_v_version_targets\`;`)
  await db.run(sql`DROP TABLE \`_skins_v_version_categories\`;`)
  await db.run(sql`DROP TABLE \`_skins_v_version_palette\`;`)
  await db.run(sql`DROP TABLE \`_skins_v\`;`)
  await db.run(sql`DROP TABLE \`github_sources\`;`)
  await db.run(sql`DROP TABLE \`moderation_logs\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
}
