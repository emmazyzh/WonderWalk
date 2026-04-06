// functions/api/_middleware.js
import { requireAuth } from '../../server/lib/auth.js'
import { unauthorized } from '../../server/lib/response.js'

export async function onRequest(context) {
  const { request, env, next } = context

  // Allow OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  // Verify auth
  const user = await requireAuth(request, env)
  if (!user) return unauthorized()

  // Attach user to context
  context.data.user = user

  return next()
}
