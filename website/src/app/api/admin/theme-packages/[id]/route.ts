import { getAuthenticatedUser } from '@/lib/server'

export const dynamic = 'force-dynamic'

const packageKinds = new Set(['theme', 'paired'])
const validationStatuses = new Set(['pending', 'passed', 'failed'])
const skinStatuses = new Set(['pending_review', 'published', 'archived'])

function isManager(user: { role?: string } | null | undefined) {
  return Boolean(user && ['admin', 'editor'].includes(user.role ?? ''))
}

function relatedID(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: number | string }).id
  return undefined
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await getAuthenticatedUser(request)
  if (!isManager(user)) return Response.json({ error: 'Admin or editor access is required.' }, { status: 403 })

  const id = (await params).id
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const packageData: Record<string, string> = {}
  if (typeof body.originalFilename === 'string' && body.originalFilename.trim()) packageData.originalFilename = body.originalFilename.trim()
  if (typeof body.packageKind === 'string' && packageKinds.has(body.packageKind)) packageData.packageKind = body.packageKind
  if (typeof body.validationStatus === 'string' && validationStatuses.has(body.validationStatus)) packageData.validationStatus = body.validationStatus
  if (typeof body.validatorVersion === 'string') packageData.validatorVersion = body.validatorVersion.trim()

  try {
    const packageDoc = await payload.update({ collection: 'theme-packages', id, data: packageData, overrideAccess: true, disableTransaction: true })
    const skins = await payload.find({ collection: 'skins', where: { package: { equals: id } }, limit: 100, depth: 0, overrideAccess: true })
    const requestedSkinID = typeof body.skinId === 'string' || typeof body.skinId === 'number' ? body.skinId : skins.docs[0]?.id
    let skin = skins.docs.find((item) => String(item.id) === String(requestedSkinID)) ?? skins.docs[0]
    if (skin) {
      const skinData: Record<string, string> = {}
      for (const field of ['title', 'slug', 'summary', 'version', 'authorDisplayName'] as const) {
        if (typeof body[field] === 'string' && body[field].trim()) skinData[field] = body[field].trim()
      }
      if (typeof body.status === 'string' && skinStatuses.has(body.status)) skinData.status = body.status
      if (Object.keys(skinData).length > 0) {
        skin = await payload.update({ collection: 'skins', id: skin.id, data: skinData, overrideAccess: true, disableTransaction: true })
      }
    }
    return Response.json({ ok: true, package: packageDoc, skin })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'The package could not be updated.' }, { status: 422 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await getAuthenticatedUser(request)
  if (user?.role !== 'admin') return Response.json({ error: 'Admin access is required to delete packages.' }, { status: 403 })

  const id = (await params).id
  try {
    const skins = await payload.find({ collection: 'skins', where: { package: { equals: id } }, limit: 100, depth: 0, overrideAccess: true })
    const mediaIDs = new Set<number | string>()
    for (const skin of skins.docs) {
      for (const value of [skin.hero, skin.logo, skin.polaroid]) {
        const mediaID = relatedID(value)
        if (mediaID !== undefined) mediaIDs.add(mediaID)
      }
      await payload.delete({ collection: 'skins', id: skin.id, overrideAccess: true, disableTransaction: true })
    }

    for (const mediaID of mediaIDs) {
      const stillUsed = await payload.find({
        collection: 'skins',
        where: { or: [{ hero: { equals: mediaID } }, { logo: { equals: mediaID } }, { polaroid: { equals: mediaID } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (stillUsed.docs.length === 0) await payload.delete({ collection: 'media', id: mediaID, overrideAccess: true, disableTransaction: true })
    }

    await payload.delete({ collection: 'theme-packages', id, overrideAccess: true, disableTransaction: true })
    return Response.json({ ok: true, deletedSkins: skins.docs.length })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'The package could not be deleted.' }, { status: 422 })
  }
}
