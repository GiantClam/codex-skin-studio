import { getCloudflareBindings, enforceRateLimit } from '@/lib/server'
import { createDownloadGrant, DOWNLOAD_GRANT_TTL_SECONDS } from '@/lib/download-grant'
import { getPublicSkin } from '@/lib/skins/catalog'

export const dynamic = 'force-dynamic'

type DownloadEnv = CloudflareEnv & { SKIN_STUDIO_DOWNLOAD_SECRET?: string }

function validSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  if (!validSlug(slug)) return Response.json({ error: 'Invalid skin slug.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

  let body: { confirm?: boolean } | null = null
  try {
    body = await request.json() as { confirm?: boolean }
  } catch {
    body = null
  }
  if (body?.confirm !== true) return Response.json({ error: 'Explicit installation confirmation is required.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

  const skin = await getPublicSkin(slug)
  if (!skin || skin.status !== 'published') return Response.json({ error: 'Published skin not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (!skin.packageSha256 || !/^[0-9a-f]{64}$/i.test(skin.packageSha256)) return Response.json({ error: 'This skin has no verified package.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })

  const env = await getCloudflareBindings() as DownloadEnv
  const limited = await enforceRateLimit(env, 'DOWNLOAD_GRANT_RATE_LIMITER', request, 'download-grant')
  if (limited) return limited
  if (!env.SKIN_STUDIO_DOWNLOAD_SECRET) return Response.json({ error: 'Download grants are not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  const grant = await createDownloadGrant(env.SKIN_STUDIO_DOWNLOAD_SECRET, { slug, packageSha256: skin.packageSha256 })
  try {
    const now = Math.floor(Date.now() / 1000)
    await env.D1.prepare('DELETE FROM download_grants WHERE expires_at < ? OR used_at IS NOT NULL AND used_at < ?').bind(now - 3600, now - 3600).run()
    await env.D1.prepare('INSERT INTO download_grants (nonce, slug, package_sha256, expires_at) VALUES (?, ?, ?, ?)').bind(grant.payload.nonce, slug, skin.packageSha256, grant.payload.exp).run()
  } catch {
    return Response.json({ error: 'Download grant storage is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const downloadUrl = new URL(`/download/${encodeURIComponent(slug)}`, request.url)
  downloadUrl.searchParams.set('grant', grant.token)
  return Response.json({
    status: 'granted',
    slug,
    packageSha256: skin.packageSha256,
    expiresAt: new Date(grant.payload.exp * 1000).toISOString(),
    ttlSeconds: DOWNLOAD_GRANT_TTL_SECONDS,
    downloadUrl: downloadUrl.toString(),
  }, { headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' } })
}
