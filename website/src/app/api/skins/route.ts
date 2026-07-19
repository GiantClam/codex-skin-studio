import { listPublicSkins } from '@/lib/skins/catalog'

export const dynamic = 'force-dynamic'

const allowedTargets = new Set(['codex', 'chatgpt', 'both'])
const allowedSorts = new Set(['recent', 'downloads'])

function bounded(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const target = url.searchParams.get('target') ?? undefined
  const sort = url.searchParams.get('sort') ?? undefined
  if (target && !allowedTargets.has(target)) return Response.json({ error: 'Unsupported target.' }, { status: 400 })
  if (sort && !allowedSorts.has(sort)) return Response.json({ error: 'Unsupported sort.' }, { status: 400 })

  const items = await listPublicSkins({
    q: url.searchParams.get('q')?.slice(0, 120),
    target,
    category: url.searchParams.get('category') ?? undefined,
    palette: url.searchParams.get('palette') ?? undefined,
    sort,
    limit: bounded(url.searchParams.get('limit'), 24, 48),
  })
  return Response.json({
    items: items.map((skin) => ({ ...skin, downloadUrl: `https://codexskinstudio.com/download/${encodeURIComponent(skin.slug)}`, installable: Boolean(skin.packageSha256) })),
    count: items.length,
  }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } })
}
