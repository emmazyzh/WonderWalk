// src/store/useCheckinStore.js
import { create } from 'zustand'
import { getCheckins, saveCheckin, deleteCheckin } from '../lib/db'
import * as api from '../lib/api'

const getChinaProvinceCode = (checkin) => {
  if (checkin.province_code) return checkin.province_code
  if (typeof checkin.code === 'string' && checkin.code.includes('-')) {
    return checkin.code.split('-')[0]
  }
  return checkin.code
}

const useCheckinStore = create((set, get) => ({
  // State
  checkins: [],           // All checkin records
  mapMode: 'china',       // 'china' | 'world'
  language: 'zh',         // 'zh' | 'en'
  isLoading: false,
  isSynced: false,

  // Setters
  setMapMode: (mode) => set({ mapMode: mode }),
  setLanguage: (lang) => set({ language: lang }),

  // Load checkins from IndexedDB first, then sync from server
  // getToken: optional Clerk getToken function
  loadCheckins: async (getToken) => {
    set({ isLoading: true })
    // 1. Load from IndexedDB immediately (no white flash)
    const cached = await getCheckins()
    if (cached.length > 0) {
      set({ checkins: cached, isLoading: false })
    }
    // 2. Sync from server
    try {
      const res = await api.get('/api/checkins', getToken)
      if (res.ok) {
        set({ checkins: res.checkins, isSynced: true, isLoading: false })
        // Update IndexedDB cache
        for (const c of res.checkins) {
          await saveCheckin(c)
        }
      }
    } catch (e) {
      console.warn('Sync failed, using cache', e)
      set({ isLoading: false })
    }
  },

  // Add a checkin
  // getToken: optional Clerk getToken function
  addCheckin: async (checkinData, getToken) => {
    // Optimistic: add to local state immediately
    const tempId = `temp_${Date.now()}`
    const tempCheckin = { ...checkinData, id: tempId, created_at: Date.now() }
    set((s) => ({ checkins: [tempCheckin, ...s.checkins] }))
    await saveCheckin(tempCheckin)

    // Sync to server
    try {
      const res = await api.post('/api/checkins', checkinData, getToken)
      if (res.ok) {
        // Replace temp entry with real one
        set((s) => ({
          checkins: s.checkins.map((c) => (c.id === tempId ? res.checkin : c)),
        }))
        await saveCheckin(res.checkin)
        // Delete temp from IndexedDB
        await deleteCheckin(tempId)
      }
    } catch (e) {
      console.warn('Failed to sync checkin', e)
    }
  },

  // Remove a checkin
  // getToken: optional Clerk getToken function
  removeCheckin: async (id, getToken) => {
    // Optimistic
    set((s) => ({ checkins: s.checkins.filter((c) => c.id !== id) }))
    await deleteCheckin(id)
    // Sync (skip temp IDs that never reached server)
    if (!id.startsWith('temp_')) {
      try {
        await api.del(`/api/checkins/${id}`, getToken)
      } catch (e) {
        console.warn('Failed to delete checkin from server', e)
      }
    }
  },

  updateCheckinTime: async (id, createdAt, getToken) => {
    set((s) => ({
      checkins: s.checkins.map((c) => (c.id === id ? { ...c, created_at: createdAt } : c)),
    }))

    const updatedCheckin = get().checkins.find((c) => c.id === id)
    if (updatedCheckin) {
      await saveCheckin(updatedCheckin)
    }

    if (!id.startsWith('temp_')) {
      try {
        await api.patch(`/api/checkins/${id}`, { created_at: createdAt }, getToken)
      } catch (e) {
        console.warn('Failed to update checkin time', e)
      }
    }
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
