import { getCloudflareBindings, getPayloadClient } from '@/lib/server'
import { verifyDownloadGrant } from '@/lib/download-grant'
import { getPublicSkin } from '@/lib/skins/catalog'

export const dynamic = 'force-dynamic'

type DownloadEnv = CloudflareEnv & { SKIN_STUDIO_DOWNLOAD_SECRET?: string }

function downloadHeaders(filename: string, packageSha256: string, size?: number) {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ETag: `"${packageSha256}"`,
    'X-Content-SHA256': packageSha256,
  })
  if (size !== undefined) headers.set('Content-Length', String(size))
  return headers
}

function getGrantToken(request: Request) {
  const urlToken = new URL(request.url).searchParams.get('grant')
  const authorization = request.headers.get('authorization')
  const headerToken = authorization?.match(/^SkinGrant\s+([^\s]+)$/i)?.[1] ?? null
  return urlToken || headerToken
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const skin = await getPublicSkin(slug)
  if (!skin || skin.status !== 'published') return new Response('Not found', { status: 404 })
  if (!skin.packageSha256 || !/^[0-9a-f]{64}$/i.test(skin.packageSha256)) return Response.json({ error: 'This skin has no verified package.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })

  const token = getGrantToken(request)
  if (!token) return Response.json({ error: 'A short-lived download grant is required.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'WWW-Authenticate': 'SkinGrant' } })

  const env = await getCloudflareBindings() as DownloadEnv
  if (!env.SKIN_STUDIO_DOWNLOAD_SECRET) return Response.json({ error: 'Download grants are not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  const grant = await verifyDownloadGrant(env.SKIN_STUDIO_DOWNLOAD_SECRET, token)
  if (!grant || grant.slug !== slug || grant.packageSha256.toLowerCase() !== skin.packageSha256.toLowerCase()) return Response.json({ error: 'The download grant is invalid or expired.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

  try {
    const payload = await getPayloadClient()
    const result = await payload.find({ collection: 'skins', where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] }, depth: 1, limit: 1, overrideAccess: true })
    const doc = result.docs[0]
    const packageValue = doc?.package
    const packageId = typeof packageValue === 'number' || typeof packageValue === 'string' ? packageValue : null
    const packageDoc = typeof packageValue === 'object' && packageValue ? packageValue : packageId ? await payload.findByID({ collection: 'theme-packages', id: packageId, overrideAccess: true }) : null
    const objectKey = packageDoc && typeof packageDoc === 'object' && typeof packageDoc.r2ObjectKey === 'string' ? packageDoc.r2ObjectKey : null
    if (!objectKey) return Response.json({ error: 'The published package is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

    const object = await env.R2.get(objectKey)
    if (!object) return Response.json({ error: 'The published package is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

    const now = Math.floor(Date.now() / 1000)
    await env.D1.prepare('DELETE FROM download_grants WHERE expires_at < ? OR used_at IS NOT NULL AND used_at < ?').bind(now - 3600, now - 3600).run()
    const consumed = await env.D1.prepare('UPDATE download_grants SET used_at = ? WHERE nonce = ? AND slug = ? AND package_sha256 = ? AND expires_at >= ? AND used_at IS NULL').bind(now, grant.nonce, slug, skin.packageSha256, now).run()
    if (consumed.meta.changes !== 1) return Response.json({ error: 'The download grant has already been used or expired.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

    await payload.update({ collection: 'skins', id: doc.id, data: { downloads: (doc.downloads ?? 0) + 1 }, overrideAccess: true, disableTransaction: true })
    const filename = `${skin.slug}-${skin.version}.zip`
    return new Response(object.body, { headers: downloadHeaders(filename, skin.packageSha256, object.size) })
  } catch {
    return Response.json({ error: 'The package could not be served right now.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
