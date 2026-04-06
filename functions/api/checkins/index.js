// functions/api/checkins/index.js
import { ok, created, err, serverError } from '../../../server/lib/response.js'
import { ensureUser, getCheckinsByUser, createCheckin } from '../../../server/lib/db.js'

export async function onRequestGet({ env, data }) {
  try {
    const { userId, email } = data.user
    await ensureUser(env.DB, { userId, email })
    const checkins = await getCheckinsByUser(env.DB, userId)
    return ok({ checkins })
  } catch (e) {
    return serverError(e)
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    const { userId, email } = data.user
    await ensureUser(env.DB, { userId, email })

    const body = await request.json()
    const { type, code, name_zh, name_en } = body

    if (!type || !code || !name_zh) {
      return err('Missing required fields: type, code, name_zh')
    }
    if (!['china_city', 'world_country'].includes(type)) {
      return err('Invalid type')
    }

    const checkin = await createCheckin(env.DB, userId, { type, code, name_zh, name_en })
    return created({ checkin })
  } catch (e) {
    return serverError(e)
  }
}
