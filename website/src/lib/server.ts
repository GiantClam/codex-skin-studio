import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getPayload } from 'payload'

export async function getPayloadClient() {
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

export async function getCloudflareBindings() {
  if (process.env.NODE_ENV !== 'production') {
    const { getPlatformProxy } = await import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`)
    const proxy = await getPlatformProxy({ environment: process.env.CLOUDFLARE_ENV, remoteBindings: false })
    return proxy.env as CloudflareEnv
  }
  const context = getCloudflareContext()
  return context.env as CloudflareEnv
}

export async function getAuthenticatedUser(request: Request) {
  const payload = await getPayloadClient()
  const auth = await payload.auth({ headers: request.headers })
  return { payload, user: auth.user }
}

export function isReviewer(user: { role?: string } | null | undefined) {
  return Boolean(user && ['admin', 'editor', 'reviewer'].includes(user.role ?? ''))
}

type RateLimitBinding = {
  limit: (options: { key: string }) => Promise<{ success: boolean; retryAfter?: number }>
}

type AbuseEnv = CloudflareEnv & {
  TURNSTILE_SECRET?: string
  TURNSTILE_ENFORCE?: string
  SKIN_STUDIO_UPLOAD_SECRET?: string
}

function clientKey(request: Request) {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'anonymous'
}

export async function enforceRateLimit(env: CloudflareEnv, bindingName: keyof CloudflareEnv, request: Request, scope: string) {
  const binding = (env as unknown as Record<string, RateLimitBinding | undefined>)[bindingName]
  if (!binding || typeof binding.limit !== 'function') return null

  try {
    const result = await binding.limit({ key: `${scope}:${clientKey(request)}` })
    if (result.success) return null
    const retryAfter = Math.max(1, Math.ceil(result.retryAfter ?? 60))
    return Response.json({ error: 'Too many requests. Please try again later.' }, {
      status: 429,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) },
    })
  } catch {
    // Local emulation may not expose the binding. Production should keep serving
    // if Cloudflare's limiter has a transient control-plane failure.
    return null
  }
}

export async function verifyTurnstile(env: AbuseEnv, request: Request, token: string | undefined) {
  const secret = env.TURNSTILE_SECRET
  const enforce = env.TURNSTILE_ENFORCE === 'true' || Boolean(secret)
  if (!secret) return { ok: !enforce, skipped: true }
  if (!token) return { ok: false, error: 'Please complete the anti-bot check.' }

  const body = new URLSearchParams({ secret, response: token })
  const ip = request.headers.get('cf-connecting-ip')
  if (ip) body.set('remoteip', ip)
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
  const result = await response.json().catch(() => ({})) as { success?: boolean }
  return result.success ? { ok: true } : { ok: false, error: 'The anti-bot check could not be verified.' }
}
