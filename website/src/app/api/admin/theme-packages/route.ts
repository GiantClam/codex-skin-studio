import { getAuthenticatedUser } from '@/lib/server'
import { parseThemePackage } from '@/lib/theme-package/zip'
import { saveThemeSubmission } from '@/lib/theme-package/ingest'
import type { ThemeCategory, ThemePalette, ThemeTarget } from '@/lib/theme-package/types'

export const dynamic = 'force-dynamic'

const allowedTargets = new Set(['codex', 'chatgpt'])
const allowedCategories = new Set(['anime-2d', 'cyber-ui', 'editorial', 'minimal', 'cozy', 'mystic'])
const allowedPalettes = new Set(['blue', 'cyan', 'green', 'orange', 'paper', 'mixed'])

function text(form: FormData, name: string, fallback = '') {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : fallback
}

function list(form: FormData, name: string, allowed: Set<string>) {
  return text(form, name).split(',').map((value) => value.trim()).filter((value) => allowed.has(value)).filter((value, index, values) => values.indexOf(value) === index)
}

function isManager(user: { role?: string } | null | undefined) {
  return Boolean(user && ['admin', 'editor'].includes(user.role ?? ''))
}

export async function GET(request: Request) {
  const { payload, user } = await getAuthenticatedUser(request)
  if (!user) return Response.json({ error: 'Authentication is required.' }, { status: 401 })
  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100) || 100, 1), 100)
  const [packages, skins] = await Promise.all([
    payload.find({ collection: 'theme-packages', limit, pagination: false, depth: 0, sort: '-createdAt', overrideAccess: true }),
    payload.find({ collection: 'skins', limit, pagination: false, depth: 1, sort: '-createdAt', overrideAccess: true }),
  ])
  return Response.json({ packages: packages.docs, skins: skins.docs }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser(request)
  if (!isManager(user)) return Response.json({ error: 'Admin or editor access is required.' }, { status: 403 })

  const form = await request.formData()
  const upload = form.get('package')
  if (!(upload instanceof File) || upload.size === 0) return Response.json({ error: 'A theme ZIP package is required.' }, { status: 400 })

  const title = text(form, 'title')
  const summary = text(form, 'summary')
  const version = text(form, 'version', '1.0.0')
  const authorDisplayName = text(form, 'authorDisplayName', 'Community contributor')
  const slug = text(form, 'slug') || undefined
  const targets = list(form, 'targets', allowedTargets) as ThemeTarget[]
  const categories = list(form, 'categories', allowedCategories) as ThemeCategory[]
  const palette = list(form, 'palette', allowedPalettes) as ThemePalette[]

  if (!title || !summary || targets.length === 0) {
    return Response.json({ error: 'Title, summary, and at least one target are required.' }, { status: 400 })
  }

  try {
    const bytes = new Uint8Array(await upload.arrayBuffer())
    const parsed = await parseThemePackage(bytes)
    if (!parsed.report.valid || !parsed.manifest) return Response.json({ error: 'The package failed validation.', report: parsed.report }, { status: 422 })

    const result = await saveThemeSubmission(
      parsed,
      { title, summary, version, targets, categories, palette, authorDisplayName, slug, sourceType: 'manual' },
      upload.name || `${parsed.manifest.id}.zip`,
    )
    return Response.json({ ok: true, packageId: result.packageDoc.id, skinId: result.skin.id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The package could not be saved.'
    const status = /already been submitted|already exists/i.test(message) ? 409 : 422
    return Response.json({ error: message }, { status })
  }
}
