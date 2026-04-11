// src/store/useCheckinStore.js
import { create } from 'zustand'
import {
  getCheckins,
  saveCheckin,
  deleteCheckin,
  getSyncQueue,
  clearCheckins,
  clearSyncQueue,
  saveSyncQueueItem,
  deleteSyncQueueItem,
} from '../lib/db'
import * as api from '../lib/api'

const getChinaProvinceCode = (checkin) => {
  if (checkin.province_code) return checkin.province_code
  if (typeof checkin.code === 'string' && checkin.code.includes('-')) {
    return checkin.code.split('-')[0]
  }
  if (/^\d{6}$/.test(String(checkin.code || ''))) {
    return `${String(checkin.code).slice(0, 2)}0000`
  }
  return checkin.code
}

const SYNC_KIND_CREATE = 'create_checkin'
const SYNC_KIND_DELETE = 'delete_checkin'
const SYNC_KIND_UPDATE_TIME = 'update_checkin_time'

const sortByCreatedAtDesc = (items) => (
  [...items].sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
)

const mergeServerWithPending = (serverCheckins, localCheckins, pendingQueue) => {
  const merged = new Map(serverCheckins.map((item) => [item.id, item]))
  const localById = new Map(localCheckins.map((item) => [item.id, item]))

  pendingQueue.forEach((item) => {
    if (item.kind === SYNC_KIND_CREATE) {
      const localCheckin = localById.get(item.localId)
      if (localCheckin) merged.set(localCheckin.id, localCheckin)
      return
    }

    if (item.kind === SYNC_KIND_DELETE) {
      merged.delete(item.checkinId)
      return
    }

    if (item.kind === SYNC_KIND_UPDATE_TIME) {
      const localCheckin = localById.get(item.checkinId)
      if (localCheckin) merged.set(localCheckin.id, localCheckin)
    }
  })

  return sortByCreatedAtDesc([...merged.values()])
}

const useCheckinStore = create((set, get) => ({
  // State
  checkins: [],           // All checkin records
  mapMode: 'china',       // 'china' | 'world'
  language: 'zh',         // 'zh' | 'en'
  isMapFullscreen: false,
  isLoading: false,
  isSynced: false,

  // Setters
  setMapMode: (mode) => set({ mapMode: mode }),
  setLanguage: (lang) => set({ language: lang }),
  setMapFullscreen: (isMapFullscreen) => set({ isMapFullscreen }),

  flushPendingSync: async (getToken) => {
    const pendingQueue = sortByCreatedAtDesc(await getSyncQueue())
    if (pendingQueue.length === 0) return

    for (const item of pendingQueue) {
      try {
        if (item.kind === SYNC_KIND_CREATE) {
          const res = await api.post('/api/checkins', item.payload, getToken)
          if (!res.ok) continue

          const mergedCheckin = { ...item.snapshot, ...res.checkin }
          set((s) => ({
            checkins: sortByCreatedAtDesc(
              s.checkins.map((checkin) => (
                checkin.id === item.localId ? mergedCheckin : checkin
              ))
            ),
          }))
          await saveCheckin(mergedCheckin)
          await deleteCheckin(item.localId)
          await deleteSyncQueueItem(item.id)
          continue
        }

        if (item.kind === SYNC_KIND_DELETE) {
          await api.del(`/api/checkins/${item.checkinId}`, getToken)
          await deleteSyncQueueItem(item.id)
          continue
        }

        if (item.kind === SYNC_KIND_UPDATE_TIME) {
          await api.patch(
            `/api/checkins/${item.checkinId}`,
            { created_at: item.createdAt },
            getToken
          )
          await deleteSyncQueueItem(item.id)
        }
      } catch (error) {
        console.warn('Pending sync failed', item.kind, error)
        break
      }
    }
  },

  // Load checkins from IndexedDB first, then sync from server
  // getToken: optional Clerk getToken function
  loadCheckins: async (getToken) => {
    set({ isLoading: true })
    // 1. Load from IndexedDB immediately (no white flash)
    const cached = await getCheckins()
    if (cached.length > 0) {
      set({ checkins: cached, isLoading: false })
    }
    await get().flushPendingSync(getToken)

    // 2. Sync from server
    try {
      const res = await api.get('/api/checkins', getToken)
      if (res.ok) {
        const localAfterFlush = await getCheckins()
        const pendingAfterFlush = await getSyncQueue()
        const nextCheckins = pendingAfterFlush.length > 0
          ? mergeServerWithPending(res.checkins, localAfterFlush, pendingAfterFlush)
          : res.checkins

        set({ checkins: nextCheckins, isSynced: true, isLoading: false })
        // Update IndexedDB cache
        for (const c of nextCheckins) {
          await saveCheckin(c)
        }
      }
    } catch (e) {
      console.warn('Sync failed, using cache', e)
      set({ isLoading: false })
    }
  },

  syncWithServer: async (getToken) => {
    set({ isLoading: true })

    await get().flushPendingSync(getToken)
    const pendingQueue = await getSyncQueue()
    if (pendingQueue.length > 0) {
      set({ isLoading: false })
      throw new Error('本地还有未完成同步的数据，请稍后重试')
    }

    const res = await api.get('/api/checkins', getToken)
    const serverCheckins = sortByCreatedAtDesc(res.checkins || [])

    await clearCheckins()
    await clearSyncQueue()
    for (const checkin of serverCheckins) {
      await saveCheckin(checkin)
    }

    set({
      checkins: serverCheckins,
      isSynced: true,
      isLoading: false,
    })
  },

  // Add a checkin
  // getToken: optional Clerk getToken function
  addCheckin: async (checkinData, getToken) => {
    // Optimistic: add to local state immediately
    const tempId = `temp_${Date.now()}`
    const createdAt = Number(checkinData.created_at) || Date.now()
    const tempCheckin = { ...checkinData, id: tempId, created_at: createdAt }
    const createPayload = { ...checkinData, created_at: createdAt }
    const queueItem = {
      id: crypto.randomUUID(),
      kind: SYNC_KIND_CREATE,
      localId: tempId,
      payload: createPayload,
      snapshot: tempCheckin,
      created_at: Date.now(),
    }

    set((s) => ({ checkins: sortByCreatedAtDesc([tempCheckin, ...s.checkins]) }))
    await saveCheckin(tempCheckin)
    await saveSyncQueueItem(queueItem)

    await get().flushPendingSync(getToken)
  },

  // Remove a checkin
  // getToken: optional Clerk getToken function
  removeCheckin: async (id, getToken) => {
    // Optimistic
    set((s) => ({ checkins: s.checkins.filter((c) => c.id !== id) }))
    await deleteCheckin(id)

    if (id.startsWith('temp_')) {
      const pendingQueue = await getSyncQueue()
      const createItem = pendingQueue.find((item) => item.kind === SYNC_KIND_CREATE && item.localId === id)
      if (createItem) {
        await deleteSyncQueueItem(createItem.id)
      }
      return
    }

    await saveSyncQueueItem({
      id: crypto.randomUUID(),
      kind: SYNC_KIND_DELETE,
      checkinId: id,
      created_at: Date.now(),
    })
    await get().flushPendingSync(getToken)
  },

  updateCheckinTime: async (id, createdAt, getToken) => {
    set((s) => ({
      checkins: sortByCreatedAtDesc(
        s.checkins.map((c) => (c.id === id ? { ...c, created_at: createdAt } : c))
      ),
    }))

    const updatedCheckin = get().checkins.find((c) => c.id === id)
    if (updatedCheckin) {
      await saveCheckin(updatedCheckin)
    }

    if (id.startsWith('temp_')) {
      const pendingQueue = await getSyncQueue()
      const createItem = pendingQueue.find((item) => item.kind === SYNC_KIND_CREATE && item.localId === id)
      if (createItem) {
        await saveSyncQueueItem({
          ...createItem,
          payload: { ...createItem.payload, created_at: createdAt },
          snapshot: { ...createItem.snapshot, created_at: createdAt },
        })
      }
      return
    }

    await saveSyncQueueItem({
      id: crypto.randomUUID(),
      kind: SYNC_KIND_UPDATE_TIME,
      checkinId: id,
      createdAt,
      created_at: Date.now(),
    })
    await get().flushPendingSync(getToken)
  },

  // Derived helpers
  getCheckedCodes: () => {
    const { checkins, mapMode } = get()
    if (mapMode === 'china') {
      return new Set(
        checkins
          .filter((c) => c.type === 'china_city')
          .map((c) => getChinaProvinceCode(c))
      )
    }

    return new Set(checkins.filter((c) => c.type === 'world_country').map((c) => c.code))
  },

  getCheckinsByCode: (code, mapMode = get().mapMode) => {
    if (mapMode === 'china') {
      return get().checkins.filter(
        (c) => c.type === 'china_city' && (getChinaProvinceCode(c) === code || c.code === code)
      )
    }

    return get().checkins.filter((c) => c.type === 'world_country' && c.code === code)
  },

  getStatsCount: () => {
    const { checkins } = get()
    const chinaCheckins = checkins.filter((c) => c.type === 'china_city')
    const chinaProvinceCodes = new Set(chinaCheckins.map((c) => getChinaProvinceCode(c)))
    const chinaCityCodes = new Set(chinaCheckins.map((c) => c.code))
    const worldCodes = new Set(checkins.filter((c) => c.type === 'world_country').map((c) => c.code))
    return {
      china: chinaProvinceCodes.size,
      chinaCities: chinaCityCodes.size,
      world: worldCodes.size,
    }
  },
}))

export default useCheckinStore
