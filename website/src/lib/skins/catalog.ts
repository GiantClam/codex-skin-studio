export type SkinTarget = 'codex' | 'chatgpt'
export type SkinCategory = 'anime-2d' | 'cyber-ui' | 'editorial' | 'minimal' | 'cozy' | 'mystic'
export type SkinPalette = 'blue' | 'cyan' | 'green' | 'orange' | 'paper' | 'mixed'
export type SkinPackageKind = 'theme' | 'paired'

export interface SkinPetSummary {
  id: string
  displayName: string
  contractVersion: string
}

export interface SkinSummary {
  slug: string
  title: string
  summary: string
  version: string
  targets: SkinTarget[]
  categories: SkinCategory[]
  palette: SkinPalette[]
  downloads: number
  publishedAt: string
  authorDisplayName: string
  art: 'arcana' | 'oxide' | 'green' | 'miku' | 'paper'
  status: 'published'
  packageKind: SkinPackageKind
  hasPet: boolean
  pet: SkinPetSummary | null
  heroUrl?: string | null
  sourceType?: 'manual' | 'github' | null
  sourceUrl?: string | null
  license?: string | null
  packageSha256?: string | null
}

const publishedSkins: SkinSummary[] = [
  { slug: 'midnight-arcana', title: 'Midnight Arcana', summary: 'A low-light theme for long coding sessions, deep prompt work and desktop threads.', version: '1.2.0', targets: ['codex', 'chatgpt'], categories: ['cyber-ui', 'mystic'], palette: ['blue', 'cyan'], downloads: 1284, publishedAt: '2026-07-18', authorDisplayName: 'Studio 17', art: 'arcana', status: 'published', packageKind: 'theme', hasPet: false, pet: null },
  { slug: 'oxide-field', title: 'Oxide Field', summary: 'Warm orange controls and a precise command-center rhythm for daily builds.', version: '2.0.1', targets: ['codex', 'chatgpt'], categories: ['cyber-ui', 'minimal'], palette: ['orange', 'paper'], downloads: 946, publishedAt: '2026-07-17', authorDisplayName: 'Nori Lab', art: 'oxide', status: 'published', packageKind: 'theme', hasPet: false, pet: null },
  { slug: 'green-room', title: 'Green Room', summary: 'A calm green workspace for planning, writing and focused agent runs.', version: '0.9.4', targets: ['chatgpt'], categories: ['cozy', 'minimal'], palette: ['green'], downloads: 714, publishedAt: '2026-07-16', authorDisplayName: 'Morrow', art: 'green', status: 'published', packageKind: 'theme', hasPet: false, pet: null },
  { slug: 'miku-signal', title: 'Miku Signal', summary: 'A bright 2D signal theme with cyan panels, playful labels and stage-light accents.', version: '1.0.3', targets: ['codex', 'chatgpt'], categories: ['anime-2d', 'cyber-ui'], palette: ['cyan', 'mixed'], downloads: 532, publishedAt: '2026-07-15', authorDisplayName: 'Signal Works', art: 'miku', status: 'published', packageKind: 'theme', hasPet: false, pet: null },
  { slug: 'paper-protocol', title: 'Paper Protocol', summary: 'A white-first interface with blue ink details for a quieter desktop.', version: '1.4.2', targets: ['codex'], categories: ['editorial', 'minimal'], palette: ['paper', 'blue'], downloads: 401, publishedAt: '2026-07-13', authorDisplayName: 'Plain Sight', art: 'paper', status: 'published', packageKind: 'theme', hasPet: false, pet: null },
]

export function listPublishedSkins(input: { q?: string; target?: string; category?: string; palette?: string; sort?: string; limit?: number } = {}) {
  const query = input.q?.trim().toLowerCase()
  const result = publishedSkins.filter((skin) => {
    if (query && ![skin.title, skin.summary, skin.authorDisplayName, ...skin.categories].join(' ').toLowerCase().includes(query)) return false
    if (input.target === 'both' && !(skin.targets.includes('codex') && skin.targets.includes('chatgpt'))) return false
    if (input.target && input.target !== 'both' && !skin.targets.includes(input.target as SkinTarget)) return false
    if (input.category && !skin.categories.includes(input.category as SkinCategory)) return false
    if (input.palette && !skin.palette.includes(input.palette as SkinPalette)) return false
    return true
  })

  if (input.sort === 'downloads') result.sort((a, b) => b.downloads - a.downloads)
  else result.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return result.slice(0, Math.min(Math.max(input.limit ?? 24, 1), 48))
}

export function getPublishedSkin(slug: string) {
  return publishedSkins.find((skin) => skin.status === 'published' && skin.slug === slug) ?? null
}

type PayloadSkinLike = {
  slug?: string
  title?: string
  summary?: string
  version?: string
  targets?: string[]
  categories?: string[] | null
  palette?: string[] | null
  downloads?: number | null
  publishedAt?: string | null
  authorDisplayName?: string | null
  art?: string | null
  status?: string
  packageKind?: 'theme' | 'paired' | null
  petId?: string | null
  petDisplayName?: string | null
  petContractVersion?: string | null
  hero?: { url?: string | null } | number | null
  sourceType?: 'manual' | 'github' | null
  sourceUrl?: string | null
  license?: string | null
  package?: { sha256?: string | null } | number | null
}

const artValues = new Set<SkinSummary['art']>(['arcana', 'oxide', 'green', 'miku', 'paper'])

export function mapPayloadSkin(doc: PayloadSkinLike): SkinSummary | null {
  if (!doc.slug || !doc.title || !doc.summary || !doc.version) return null
  const targets = (doc.targets ?? []).filter((target): target is SkinTarget => target === 'codex' || target === 'chatgpt')
  if (targets.length === 0) return null
  const categories = (doc.categories ?? []).filter((category): category is SkinCategory => ['anime-2d', 'cyber-ui', 'editorial', 'minimal', 'cozy', 'mystic'].includes(category))
  const palette = (doc.palette ?? []).filter((color): color is SkinPalette => ['blue', 'cyan', 'green', 'orange', 'paper', 'mixed'].includes(color))
  const art = artValues.has(doc.art as SkinSummary['art']) ? doc.art as SkinSummary['art'] : 'paper'
  const heroUrl = typeof doc.hero === 'object' && doc.hero ? doc.hero.url ?? null : null
  const packageSha256 = typeof doc.package === 'object' && doc.package ? doc.package.sha256 ?? null : null
  const packageKind = doc.packageKind === 'paired' ? 'paired' : 'theme'
  const pet = packageKind === 'paired' && doc.petId && doc.petDisplayName && doc.petContractVersion ? {
    id: doc.petId,
    displayName: doc.petDisplayName,
    contractVersion: doc.petContractVersion,
  } : null
  return {
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    version: doc.version,
    targets,
    categories,
    palette,
    downloads: doc.downloads ?? 0,
    publishedAt: doc.publishedAt ?? '',
    authorDisplayName: doc.authorDisplayName ?? 'Community contributor',
    art,
    status: 'published',
    packageKind,
    hasPet: packageKind === 'paired',
    pet,
    heroUrl,
    sourceType: doc.sourceType,
    sourceUrl: doc.sourceUrl,
    license: doc.license,
    packageSha256,
  }
}

function filterSkins(skins: SkinSummary[], input: { q?: string; target?: string; category?: string; palette?: string; sort?: string; limit?: number } = {}) {
  const query = input.q?.trim().toLowerCase()
  const result = skins.filter((skin) => {
    if (query && ![skin.title, skin.summary, skin.authorDisplayName, ...skin.categories].join(' ').toLowerCase().includes(query)) return false
    if (input.target === 'both' && !(skin.targets.includes('codex') && skin.targets.includes('chatgpt'))) return false
    if (input.target && input.target !== 'both' && !skin.targets.includes(input.target as SkinTarget)) return false
    if (input.category && !skin.categories.includes(input.category as SkinCategory)) return false
    if (input.palette && !skin.palette.includes(input.palette as SkinPalette)) return false
    return true
  })
  if (input.sort === 'downloads') result.sort((a, b) => b.downloads - a.downloads)
  else result.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return result.slice(0, Math.min(Math.max(input.limit ?? 24, 1), 48))
}

export async function listPublicSkins(input: { q?: string; target?: string; category?: string; palette?: string; sort?: string; limit?: number } = {}) {
  try {
    const { getPayloadClient } = await import('@/lib/server')
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'skins',
      where: { status: { equals: 'published' } },
      depth: 2,
      limit: 100,
      pagination: false,
      overrideAccess: true,
    })
    const docs = result.docs.map((doc) => mapPayloadSkin(doc as PayloadSkinLike)).filter((doc): doc is SkinSummary => Boolean(doc))
    if (docs.length > 0) return filterSkins(docs, input)
  } catch {
    // The fixture catalog keeps the local preview usable before the first D1 seed.
  }
  return listPublishedSkins(input)
}

export async function getPublicSkin(slug: string) {
  const skins = await listPublicSkins({ limit: 48 })
  // Keep bundled themes addressable while a remote catalog is partially seeded.
  return skins.find((skin) => skin.slug === slug) ?? getPublishedSkin(slug)
}
