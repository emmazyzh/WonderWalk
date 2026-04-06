// src/lib/db.js — IndexedDB via idb
import { openDB } from 'idb'

const DB_NAME = 'wonderwalk'
const DB_VERSION = 1

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

export async function getUser() {
  const db = await getDB()
  const all = await db.getAll('user')
  return all[0] || null
}

export async function saveUser(user) {
  const db = await getDB()
  return db.put('user', user)
}
