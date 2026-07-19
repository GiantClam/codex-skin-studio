import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { buildConfig } from 'payload'
import type { GetPlatformProxyOptions } from 'wrangler'

import { GitHubSources } from './collections/GitHubSources'
import { Media } from './collections/Media'
import { ModerationLogs } from './collections/ModerationLogs'
import { Skins } from './collections/Skins'
import { ThemePackages } from './collections/ThemePackages'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const isPayloadCliCommand = new Set(['migrate', 'migrate:create', 'migrate:down', 'migrate:refresh', 'migrate:reset', 'migrate:fresh', 'migrate:status', 'generate:types', 'generate:importmap'])
const isCLI = process.argv.some((value) => /payload[\\/]bin\.js$/.test(value) || /payload[\\/]dist[\\/]bin\.js$/.test(value) || isPayloadCliCommand.has(value))
const isProduction = process.env.NODE_ENV === 'production'
const isBuild = process.env.NEXT_PHASE === 'phase-production-build'

const cloudflare = isBuild
  ? { env: { D1: {} as D1Database, R2: {} as R2Bucket } }
  : isCLI || !isProduction
  ? await getCloudflareContextFromWrangler()
  : getCloudflareContext()

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: dirname },
  },
  collections: [Users, Media, ThemePackages, Skins, GitHubSources, ModerationLogs],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: sqliteD1Adapter({ binding: cloudflare.env.D1 }),
  plugins: [
    r2Storage({
      bucket: cloudflare.env.R2,
      collections: { media: true, 'theme-packages': true },
    }),
  ],
  onInit: async (payload) => {
    if (!fs.existsSync(path.resolve(dirname, 'payload-types.ts'))) payload.logger.info('Run `npm run generate:types` to create Payload types.')
  },
})

async function getCloudflareContextFromWrangler() {
  const { getPlatformProxy } = await import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`)
  return getPlatformProxy({ environment: process.env.CLOUDFLARE_ENV, remoteBindings: isProduction && !isBuild } satisfies GetPlatformProxyOptions)
}
