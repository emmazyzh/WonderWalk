// functions/api/checkins/[id].js
import { ok, notFound, err, serverError } from '../../../server/lib/response.js'
import { deleteCheckinById, updateCheckinTimeById } from '../../../server/lib/db.js'

export async function onRequestPatch({ request, params, env, data }) {
  try {
    const { userId } = data.user
    const { id } = params
    const body = await request.json()
    const createdAt = Number(body.created_at)

    if (!Number.isFinite(createdAt)) {
      return err('Invalid created_at')
    }

    const updated = await updateCheckinTimeById(env.DB, id, userId, createdAt)
    if (!updated) return notFound()
    return ok({ updated: true, id, created_at: createdAt })
  } catch (e) {
    return serverError(e)
  }
}

export async function onRequestDelete({ params, env, data }) {
  try {
    const { userId } = data.user
    const { id } = params
    const deleted = await deleteCheckinById(env.DB, id, userId)
    if (!deleted) return notFound()
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e)
  }
}
