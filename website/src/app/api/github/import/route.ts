import { saveThemeSubmission } from '@/lib/theme-package/ingest'
import { enforceRateLimit, getCloudflareBindings, getPayloadClient, verifyTurnstile } from '@/lib/server'
import { parseThemePackage } from '@/lib/theme-package/zip'
import type { ThemeCategory, ThemePalette, ThemeTarget } from '@/lib/theme-package/types'
import { MAX_ARCHIVE_BYTES } from '@/lib/theme-package/validator.mjs'

export const dynamic = 'force-dynamic'

function parseRepository(value: string) {
  const match = value.trim().match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i)
  return match ? { owner: match[1], repository: match[2] } : null
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { repositoryUrl?: string; packageUrl?: string; title?: string; summary?: string; version?: string; targets?: string[]; categories?: string[]; palette?: string[]; authorDisplayName?: string; cfTurnstileResponse?: string }
  const env = await getCloudflareBindings()
  const limited = await enforceRateLimit(env, 'GITHUB_IMPORT_RATE_LIMITER', request, 'github-import')
  if (limited) return limited
  const turnstile = await verifyTurnstile(env, request, body.cfTurnstileResponse)
  if (!turnstile.ok) return Response.json({ error: turnstile.error ?? 'Anti-bot verification failed.' }, { status: 403 })
  const repositoryUrl = body.repositoryUrl?.trim() ?? ''
  const repository = parseRepository(repositoryUrl)
  if (!repository) return Response.json({ error: 'repositoryUrl must be a GitHub repository URL.' }, { status: 400 })
  const token = (env as CloudflareEnv & { GITHUB_TOKEN?: string }).GITHUB_TOKEN
  const githubHeaders = { Accept: 'application/vnd.github+json', 'User-Agent': 'codex-skin-archive', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const metadataResponse = await fetch(`https://api.github.com/repos/${repository.owner}/${repository.repository}`, { headers: githubHeaders })
  if (!metadataResponse.ok) return Response.json({ error: `GitHub repository lookup failed with status ${metadataResponse.status}.` }, { status: 502 })
  const metadata = await metadataResponse.json() as { default_branch?: string; stargazers_count?: number; license?: { spdx_id?: string } | null }
  const branch = metadata.default_branch ?? 'main'
  const packageUrl = body.packageUrl?.trim() || `https://codeload.github.com/${repository.owner}/${repository.repository}/zip/refs/heads/${encodeURIComponent(branch)}`
  const sourcePayload = {
    repositoryUrl,
    owner: repository.owner,
    repository: repository.repository,
    defaultBranch: branch,
    licenseSpdxId: metadata.license?.spdx_id ?? undefined,
    stars: metadata.stargazers_count ?? undefined,
    sourceSnapshotUrl: packageUrl,
    status: 'reviewing' as const,
  }
  const payload = await getPayloadClient()
  const source = await payload.create({ collection: 'github-sources', data: sourcePayload, overrideAccess: true, disableTransaction: true })

  const archiveResponse = await fetch(packageUrl, { headers: { ...githubHeaders, Accept: 'application/zip' } })
  if (!archiveResponse.ok) {
    await payload.update({ collection: 'github-sources', id: source.id, data: { status: 'ignored', notes: `Package download failed with status ${archiveResponse.status}.` }, overrideAccess: true, disableTransaction: true })
    return Response.json({ error: `GitHub package download failed with status ${archiveResponse.status}.`, sourceId: source.id }, { status: 502 })
  }
  const declaredSize = Number(archiveResponse.headers.get('content-length') ?? 0)
  if (declaredSize > MAX_ARCHIVE_BYTES) {
    await payload.update({ collection: 'github-sources', id: source.id, data: { status: 'ignored', notes: 'Repository archive exceeds the 50 MB package limit.' }, overrideAccess: true, disableTransaction: true })
    return Response.json({ error: 'Repository archive exceeds the 50 MB package limit.', sourceId: source.id }, { status: 413 })
  }
  const parsed = await parseThemePackage(new Uint8Array(await archiveResponse.arrayBuffer())).catch((error) => ({ error: error instanceof Error ? error.message : 'The GitHub archive could not be read.' }))
  if ('error' in parsed || !parsed.report.valid || !parsed.manifest) {
    const report = ('error' in parsed ? { valid: false, errors: [parsed.error] } : parsed.report) as unknown as Record<string, unknown>
    await payload.update({ collection: 'github-sources', id: source.id, data: { status: 'ignored', matchedFiles: report, notes: 'Repository did not contain a valid root theme package.' }, overrideAccess: true, disableTransaction: true })
    return Response.json({ error: 'The GitHub repository did not contain a valid theme package.', sourceId: source.id, report }, { status: 422 })
  }

  const slug = parsed.manifest.id
  const existingSkin = await payload.find({ collection: 'skins', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true })
  if (existingSkin.docs.length > 0) {
    await payload.update({ collection: 'github-sources', id: source.id, data: { status: 'ignored', notes: `A skin with slug ${slug} already exists.` }, overrideAccess: true, disableTransaction: true })
    return Response.json({ error: `A skin with slug ${slug} already exists.`, sourceId: source.id }, { status: 409 })
  }

  const result = await saveThemeSubmission(parsed, {
    title: body.title?.trim() || parsed.manifest.name,
    summary: body.summary?.trim() || parsed.manifest.copy?.tagline || `A GitHub theme package for ${parsed.manifest.name}.`,
    version: body.version?.trim() || '1.0.0',
    targets: (body.targets?.filter(Boolean) ?? ['codex', 'chatgpt']) as ThemeTarget[],
    categories: (body.categories?.filter(Boolean) ?? ['cyber-ui']) as ThemeCategory[],
    palette: (body.palette?.filter(Boolean) ?? ['mixed']) as ThemePalette[],
    authorDisplayName: body.authorDisplayName?.trim() || `${repository.owner}/${repository.repository}`,
    sourceType: 'github',
    sourceUrl: repositoryUrl,
  }, `${parsed.manifest.id}.zip`)
  await payload.update({ collection: 'github-sources', id: source.id, data: { status: 'imported', matchedFiles: parsed.entries, notes: `Imported as pending-review skin ${result.skin.slug}.` }, overrideAccess: true, disableTransaction: true })
  return Response.json({ ok: true, sourceId: source.id, skinId: result.skin.id, slug: result.skin.slug, status: 'pending_review', report: parsed.report }, { status: 201 })
}
