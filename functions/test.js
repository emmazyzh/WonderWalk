export async function onRequestGet({ env }) {
  try {
    const res = await env.DB.prepare('SELECT id FROM users LIMIT 1').all()
    return new Response(JSON.stringify({ 
      success: true,
      data: res.results
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch(e) {
    return new Response(e.message, { status: 500 })
  }
}
