// functions/api/plaza/index.js
import { ok, serverError } from '../../../server/lib/response.js'
import { getPlazaStats } from '../../../server/lib/db.js'

export async function onRequestGet({ env }) {
  try {
    const stats = await getPlazaStats(env.DB)
    return ok({ users: stats })
  } catch (e) {
    return serverError(e)
  }
}
