// server/lib/auth.js — Verify Clerk JWT in Cloudflare Workers
import { unauthorized } from './response.js'

/**
 * Verify Clerk JWT and return { userId, email } or null
 * Uses Clerk's JWKS endpoint via fetch+cache
 */
export async function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  try {
    // Decode header to get kid
    const [headerB64] = token.split('.')
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')))
    const { kid } = header

    // Fetch JWKS from Clerk (cached by CF)
    const jwksUrl = `https://${env.CLERK_DOMAIN}/.well-known/jwks.json`
    const jwksRes = await fetch(jwksUrl, {
      cf: { cacheEverything: true, cacheTtl: 3600 },
    })
    const { keys } = await jwksRes.json()
    const jwk = keys.find((k) => k.kid === kid)
    if (!jwk) return null

    // Import key and verify
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const [, payloadB64, sigB64] = token.split('.')
    const data = new TextEncoder().encode(`${token.split('.')[0]}.${payloadB64}`)
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data)
    if (!valid) return null

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return { userId: payload.sub, email: payload.email || null }
  } catch (e) {
    console.error('Auth error:', e)
    return null
  }
}

/**
 * Middleware helper — returns user or sends 401
 */
export async function requireAuth(request, env) {
  const user = await verifyAuth(request, env)
  return user
}
