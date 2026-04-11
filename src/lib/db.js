// src/lib/db.js — IndexedDB via idb
import { openDB } from 'idb'

const DB_NAME = 'wonderwalk'
const DB_VERSION = 2

let _db = null

async function getDB() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('checkins')) {
        const store = db.createObjectStore('checkins', { keyPath: 'id' })
        store.createIndex('by_user', 'user_id')
        store.createIndex('by_type', 'type')
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id' })
        store.createIndex('by_kind', 'kind')
        store.createIndex('by_created_at', 'created_at')
      }
      if (!db.objectStoreNames.contains('user')) {
        db.createObjectStore('user', { keyPath: 'id' })
      }
    },
  })
  return _db
}

export async function getCheckins() {
  const db = await getDB()
  return db.getAll('checkins')
}

export async function saveCheckin(checkin) {
  const db = await getDB()
  return db.put('checkins', checkin)
}

export async function deleteCheckin(id) {
  const db = await getDB()
  return db.delete('checkins', id)
}

export async function clearCheckins() {
  const db = await getDB()
  return db.clear('checkins')
}

export async function getSyncQueue() {
  const db = await getDB()
  return db.getAll('sync_queue')
}

export async function saveSyncQueueItem(item) {
  const db = await getDB()
  return db.put('sync_queue', item)
}

export async function deleteSyncQueueItem(id) {
  const db = await getDB()
  return db.delete('sync_queue', id)
}

export async function clearSyncQueue() {
  const db = await getDB()
  return db.clear('sync_queue')
}

export async function getUser() {
  const db = await getDB()
  const all = await db.getAll('user')
  return all[0] || null
}

export async function saveUser(user) {
  const db = await getDB()
  return db.put('user', user)
}
