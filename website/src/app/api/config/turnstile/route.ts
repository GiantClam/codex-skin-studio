import { getCloudflareBindings } from '@/lib/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const env = await getCloudflareBindings()
  const siteKey = (env as CloudflareEnv & { TURNSTILE_SITE_KEY?: string }).TURNSTILE_SITE_KEY
  return Response.json({ siteKey: siteKey ?? null }, { headers: { 'Cache-Control': 'no-store' } })
}
