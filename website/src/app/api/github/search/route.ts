import { getCloudflareBindings } from '@/lib/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return Response.json({ error: 'Search query must be at least two characters.' }, { status: 400 })
  const env = await getCloudflareBindings()
  const token = (env as CloudflareEnv & { GITHUB_TOKEN?: string }).GITHUB_TOKEN
  const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=12&sort=stars`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'codex-skin-archive',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) return Response.json({ error: `GitHub search failed with status ${response.status}.` }, { status: 502 })
  const data = await response.json() as { items?: Array<Record<string, unknown>> }
  const items = (data.items ?? []).map((item) => ({
    repositoryUrl: item.html_url,
    fullName: item.full_name,
    description: item.description,
    defaultBranch: item.default_branch,
    licenseSpdxId: (item.license as { spdx_id?: string } | null)?.spdx_id ?? null,
    stars: item.stargazers_count,
    updatedAt: item.updated_at,
  }))
  return Response.json({ items })
}

