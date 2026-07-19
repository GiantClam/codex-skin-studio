import { saveThemeSubmission } from '@/lib/theme-package/ingest'
import { parseThemePackage } from '@/lib/theme-package/zip'
import { canonicalMetadata, sha256Hex, skillUploadMessage, verifySkillUploadSignature } from '@/lib/skill-upload'
import { enforceRateLimit, getCloudflareBindings } from '@/lib/server'
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

function typedList<T extends string>(form: FormData, name: string, allowed: Set<string>) {
  return list(form, name, allowed) as T[]
}

function validSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const env = await getCloudflareBindings()
  const limited = await enforceRateLimit(env, 'SUBMIT_RATE_LIMITER', request, 'submit')
  if (limited) return limited
  const uploadEnv = env as CloudflareEnv & { SKIN_STUDIO_UPLOAD_SECRET?: string }
  const secret = uploadEnv.SKIN_STUDIO_UPLOAD_SECRET
  if (!secret) return jsonResponse({ error: 'Skill upload is not configured.' }, 503)
  if (request.headers.get('x-codex-skin-client') !== 'codex-skin-studio') return jsonResponse({ error: 'This endpoint accepts uploads from the Codex Skin Studio skill.' }, 401)
  const timestamp = request.headers.get('x-codex-skin-timestamp') ?? ''
  const requestId = request.headers.get('x-codex-skin-request-id') ?? ''
  const signature = request.headers.get('x-codex-skin-signature') ?? ''
  const timestampNumber = Number(timestamp)
  if (!/^\d{10,}$/.test(timestamp) || !Number.isFinite(timestampNumber) || Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 300) return jsonResponse({ error: 'The upload signature has expired.' }, 401)
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return jsonResponse({ error: 'A valid upload request id is required.' }, 400)
  const form = await request.formData()
  const upload = form.get('package')
  if (!upload || typeof upload !== 'object' || !('arrayBuffer' in upload)) return jsonResponse({ error: 'A theme ZIP package is required.' }, 400)

  const bytes = new Uint8Array(await (upload as File).arrayBuffer())
  if (bytes.byteLength === 0) return jsonResponse({ error: 'The uploaded package is empty.' }, 400)
  const metadataRaw = text(form, 'metadata')
  if (!metadataRaw) return jsonResponse({ error: 'Signed theme metadata is required.' }, 400)
  let metadataInput: Record<string, unknown>
  try {
    const parsedMetadata = JSON.parse(metadataRaw) as unknown
    if (!parsedMetadata || typeof parsedMetadata !== 'object' || Array.isArray(parsedMetadata)) throw new Error('metadata must be an object')
    metadataInput = parsedMetadata as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Signed theme metadata is invalid JSON.' }, 400)
  }
  const packageHash = await sha256Hex(bytes)
  const metadataHash = await sha256Hex(canonicalMetadata(metadataInput))
  const validSignature = await verifySkillUploadSignature(secret, skillUploadMessage(new URL(request.url).pathname, timestamp, requestId, packageHash, metadataHash), signature)
  if (!validSignature) return jsonResponse({ error: 'The upload signature is invalid.' }, 401)
  const now = Math.floor(Date.now() / 1000)
  try {
    await env.D1.prepare('DELETE FROM skill_upload_nonces WHERE created_at < ?').bind(now - 3600).run()
    const nonce = await env.D1.prepare('INSERT OR IGNORE INTO skill_upload_nonces (request_id, created_at) VALUES (?, ?)').bind(requestId, now).run()
    if ((nonce.meta?.changes ?? 0) !== 1) return jsonResponse({ error: 'This upload request has already been used.' }, 409)
  } catch {
    return jsonResponse({ error: 'Upload replay protection is temporarily unavailable.' }, 503)
  }

  let parsed
  try {
    parsed = await parseThemePackage(bytes)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'The ZIP package could not be read.' }, 422)
  }
  if (!parsed.report.valid || !parsed.manifest) return jsonResponse({ error: 'The package failed validation.', report: parsed.report }, 422)
  const declaredPackageKind = typeof metadataInput.packageKind === 'string' ? metadataInput.packageKind.trim() : ''
  if (declaredPackageKind && declaredPackageKind !== 'theme' && declaredPackageKind !== 'paired') return jsonResponse({ error: 'Signed packageKind must be theme or paired.' }, 400)
  if (declaredPackageKind && declaredPackageKind !== parsed.kind) return jsonResponse({ error: 'Signed packageKind does not match the uploaded ZIP package.' }, 400)

  const metadata = (name: string, fallback = '') => typeof metadataInput[name] === 'string' ? String(metadataInput[name]).trim() : fallback
  const metadataList = (name: string, allowed: Set<string>) => Array.isArray(metadataInput[name]) ? (metadataInput[name] as unknown[]).filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter((value) => allowed.has(value)).filter((value, index, values) => values.indexOf(value) === index) : []
  const title = metadata('title', parsed.manifest.name)
  const slug = metadata('slug', parsed.manifest.id)
  const summary = metadata('summary', parsed.manifest.copy?.tagline ?? `A community theme package for ${parsed.manifest.name}.`)
  const version = metadata('version', '1.0.0')
  const targets = metadataList('targets', allowedTargets) as ThemeTarget[]
  const categories = metadataList('categories', allowedCategories) as ThemeCategory[]
  const palette = metadataList('palette', allowedPalettes) as ThemePalette[]
  const authorDisplayName = metadata('authorDisplayName', parsed.manifest.copy?.brand ?? 'Community contributor')
  const sourceUrl = metadata('sourceUrl')
  const license = metadata('license')
  if (!title || title.length > 80) return jsonResponse({ error: 'Title is required and must be at most 80 characters.' }, 400)
  if (!validSlug(slug)) return jsonResponse({ error: 'Slug must contain lowercase letters, numbers, and hyphens only.' }, 400)
  if (parsed.kind === 'paired' && slug !== parsed.manifest.id) return jsonResponse({ error: 'Paired package slug must match its bundle, theme, and Pet IDs.' }, 400)
  if (!summary || summary.length > 180) return jsonResponse({ error: 'Summary is required and must be at most 180 characters.' }, 400)
  if (!authorDisplayName || authorDisplayName.length > 80) return jsonResponse({ error: 'Author display name is required and must be at most 80 characters.' }, 400)
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) return jsonResponse({ error: 'Version must use semantic version format, for example 1.0.0.' }, 400)
  if (targets.length === 0) return jsonResponse({ error: 'Select at least one supported target.' }, 400)
  if (sourceUrl && !/^https:\/\/(github\.com|www\.github\.com)\//i.test(sourceUrl)) return jsonResponse({ error: 'Source URL must be a GitHub HTTPS URL.' }, 400)

  try {
    const result = await saveThemeSubmission(parsed, { title, slug, summary, version, targets, categories, palette, authorDisplayName, sourceType: sourceUrl ? 'github' : 'manual', sourceUrl: sourceUrl || undefined, license: license || undefined }, typeof (upload as File).name === 'string' ? (upload as File).name : `${parsed.manifest.id}.zip`)
    return jsonResponse({ ok: true, status: 'pending_review', skinId: result.skin.id, slug: result.skin.slug, report: parsed.report }, 201)
  } catch (error) {
    const status = error instanceof Error && (error.message.includes('already been submitted') || error.message.includes('already exists')) ? 409 : 500
    return jsonResponse({ error: error instanceof Error ? error.message : 'The package could not be saved.' }, status)
  }
}
