// src/lib/sync.js
// 同步策略：管理 IndexedDB 与服务端间的数据一致性
import { getCheckins, saveCheckin, deleteCheckin, clearCheckins } from './db'
import * as api from './api'

/**
 * 全量同步：从服务端拉取最新数据，覆盖本地缓存
 * @param {Function} getToken - Clerk getToken 函数
 * @returns {Array} 最新的 checkins
 */
export async function syncFromServer(getToken) {
  try {
    const res = await api.get('/api/checkins', getToken)
    if (!res.ok) throw new Error(res.error || 'sync failed')

    const serverCheckins = res.checkins || []
    // 清空本地再写入（全量覆盖）
    await clearCheckins()
    for (const c of serverCheckins) {
      await saveCheckin(c)
    }
    return serverCheckins
  } catch (e) {
    console.warn('[sync] syncFromServer failed:', e.message)
    // 降级到本地缓存
    return getCheckins()
  }
}

/**
 * 清除本地缓存（登出时调用）
 */
export async function clearLocalData() {
  await clearCheckins()
}
