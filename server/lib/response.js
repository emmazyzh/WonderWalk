// server/lib/response.js
export const ok = (data) => Response.json({ ok: true, ...data }, { status: 200 })
export const created = (data) => Response.json({ ok: true, ...data }, { status: 201 })
export const err = (msg, status = 400) => Response.json({ ok: false, error: msg }, { status })
export const unauthorized = () => err('Unauthorized', 401)
export const forbidden = () => err('Forbidden', 403)
export const notFound = () => err('Not found', 404)
export const serverError = (err) => {
  console.error('[Server Error]', err)
  return new Response(JSON.stringify({ 
    error: err.message || 'Internal server error',
    stack: err.stack 
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const cors = (res) => {
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return new Response(res.body, { status: res.status, headers })
}
