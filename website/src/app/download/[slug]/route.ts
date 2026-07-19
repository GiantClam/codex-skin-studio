import { getCloudflareBindings, getPayloadClient } from '@/lib/server'
import { getPublicSkin } from '@/lib/skins/catalog'
import { createStoredZip } from '@/lib/theme-package/zip'

export const dynamic = 'force-dynamic'

const demoWebP = Uint8Array.from(atob('UklGRiIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA='), (char) => char.charCodeAt(0))

function downloadHeaders(filename: string, size?: number) {
  const headers = new Headers({
    'Cache-Control': 'public, max-age=3600, immutable',
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`,
  })
  if (size !== undefined) headers.set('Content-Length', String(size))
  return headers
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const skin = await getPublicSkin(slug)
  if (!skin) return new Response('Not found', { status: 404 })
  const filename = `${skin.slug}-${skin.version}.zip`

  try {
    const payload = await getPayloadClient()
    const result = await payload.find({ collection: 'skins', where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] }, depth: 1, limit: 1, overrideAccess: true })
    const doc = result.docs[0]
    const packageValue = doc?.package
    const packageId = typeof packageValue === 'number' || typeof packageValue === 'string' ? packageValue : null
    const packageDoc = typeof packageValue === 'object' && packageValue ? packageValue : packageId ? await payload.findByID({ collection: 'theme-packages', id: packageId, overrideAccess: true }) : null
    const objectKey = packageDoc && typeof packageDoc === 'object' ? packageDoc.r2ObjectKey : null
    if (objectKey) {
      const env = await getCloudflareBindings()
      const object = await env.R2.get(objectKey)
      if (object) {
        await payload.update({ collection: 'skins', id: doc.id, data: { downloads: (doc.downloads ?? 0) + 1 }, overrideAccess: true, disableTransaction: true })
        return new Response(object.body, { headers: downloadHeaders(filename, object.size) })
      }
    }
  } catch {
    // The static preview catalog below remains downloadable before the first D1 seed.
  }

  const manifest = new TextEncoder().encode(JSON.stringify({
    schemaVersion: 1,
    id: skin.slug,
    name: skin.title,
    hero: 'hero.webp',
    colors: { accent: '#1769D4', secondary: '#20BFD0', surface: '#FFFFFF', text: '#18313B' },
    copy: { brand: skin.authorDisplayName, tagline: skin.summary },
  }, null, 2))
  const archive = createStoredZip({ 'theme.json': manifest, 'hero.webp': demoWebP })
  return new Response(archive, { headers: downloadHeaders(filename, archive.byteLength) })
}
