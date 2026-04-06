// functions/api/users/me.js
import { ok, err, serverError } from '../../../server/lib/response.js'
import { ensureUser, getUserById, updateUser } from '../../../server/lib/db.js'

export async function onRequestGet({ env, data }) {
  try {
    const { userId, email } = data.user
    await ensureUser(env.DB, { userId, email })
    const user = await getUserById(env.DB, userId)
    return ok({ user })
  } catch (e) {
    return serverError(e)
  }
}

export async function onRequestPatch({ request, env, data }) {
  try {
    const { userId } = data.user
    const body = await request.json()
    const { nickname } = body
    if (!nickname?.trim()) return err('nickname is required')
    await updateUser(env.DB, userId, { nickname: nickname.trim() })
    return ok({ updated: true })
  } catch (e) {
    return serverError(e)
  }
}
