// src/lib/api.js — fetch wrapper for /api/*
import { useAuth } from '@clerk/clerk-react'

// We export a plain function that takes the Clerk getToken
// Usage: const { getToken } = useAuth(); await api.get('/api/checkins', getToken)

async function request(method, path, body, getToken) {
  const headers = { 'Content-Type': 'application/json' }
  if (getToken) {
    const token = await getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.stack) {
      console.error('Backend Error Stack:', err.stack)
      throw new Error(`${err.error || err.message}\n${err.stack}`)
    }
    throw new Error(err.error || err.message || 'Internal server error')
  }
  const data = await res.json()
  return data
}

export const get = (path, getToken) => request('GET', path, null, getToken)
export const post = (path, body, getToken) => request('POST', path, body, getToken)
export const patch = (path, body, getToken) => request('PATCH', path, body, getToken)
export const del = (path, getToken) => request('DELETE', path, null, getToken)

// Hook-based wrapper for use inside components
export function useAPI() {
  const { getToken } = useAuth()
  return {
    get: (path) => get(path, getToken),
    post: (path, body) => post(path, body, getToken),
    patch: (path, body) => patch(path, body, getToken),
    del: (path) => del(path, getToken),
  }
}
