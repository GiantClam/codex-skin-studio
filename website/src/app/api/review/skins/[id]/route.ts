import { getAuthenticatedUser, isReviewer } from '@/lib/server'

export const dynamic = 'force-dynamic'

const actions = new Set(['publish', 'approve', 'reject', 'archive', 'unpublish'])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, user } = await getAuthenticatedUser(request)
  if (!isReviewer(user)) return Response.json({ error: 'Reviewer access is required.' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { action?: string; note?: string }
  if (!body.action || !actions.has(body.action)) return Response.json({ error: 'Action must be publish, reject, archive, or unpublish.' }, { status: 400 })

  const id = (await params).id
  const skin = await payload.findByID({ collection: 'skins', id, depth: 0, overrideAccess: true })
  if (!skin) return Response.json({ error: 'Skin not found.' }, { status: 404 })

  const action = body.action === 'approve' || body.action === 'publish' ? 'published' : body.action === 'reject' ? 'rejected' : body.action === 'unpublish' ? 'draft' : 'archived'
  const now = new Date().toISOString()
  const updated = await payload.update({
    collection: 'skins',
    id,
    data: {
      status: action,
      reviewNote: body.note?.trim() || undefined,
      rejectionReason: action === 'rejected' ? body.note?.trim() || undefined : undefined,
      reviewedBy: user!.id,
      reviewedAt: now,
      publishedAt: action === 'published' ? now : undefined,
    },
    overrideAccess: true,
    disableTransaction: true,
  })
  await payload.create({
    collection: 'moderation-logs',
    data: {
      skin: updated.id,
      actor: user!.id,
      action: action === 'published' ? 'published' : action === 'rejected' ? 'rejected' : action === 'archived' ? 'archived' : action === 'draft' ? 'unpublished' : 'approved',
      note: body.note?.trim() || undefined,
    },
    overrideAccess: true,
    disableTransaction: true,
  })
  return Response.json({ ok: true, skin: updated })
}

