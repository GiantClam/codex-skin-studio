import config from '@payload-config'
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_PUT } from '@payloadcms/next/routes'

import { getPublicSkin } from '@/lib/skins/catalog'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  if (/^\d+$/.test(slug)) return REST_GET(config)(_request, { params: Promise.resolve({ slug: ['skins', slug] }) })
  const skin = await getPublicSkin(slug)
  if (!skin) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ...skin, downloadUrl: `https://codexskinstudio.com/download/${encodeURIComponent(skin.slug)}`, installable: Boolean(skin.packageSha256) }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } })
}

export async function OPTIONS(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return REST_OPTIONS(config)(request, { params: Promise.resolve({ slug: ['skins', (await params).slug] }) })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return REST_PATCH(config)(request, { params: Promise.resolve({ slug: ['skins', (await params).slug] }) })
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return REST_PUT(config)(request, { params: Promise.resolve({ slug: ['skins', (await params).slug] }) })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return REST_DELETE(config)(request, { params: Promise.resolve({ slug: ['skins', (await params).slug] }) })
}
