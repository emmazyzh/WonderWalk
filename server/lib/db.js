// server/lib/db.js — D1 query helpers

// Ensure user exists (upsert on first login)
export async function ensureUser(db, { userId, email }) {
  await ensureCheckinColumns(db)
  const existing = await db.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
  if (!existing) {
    await db
      .prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)')
      .bind(userId, email || '', Date.now())
      .run()
  }
  return userId
}

async function ensureCheckinColumns(db) {
  const { results } = await db.prepare('PRAGMA table_info(checkins)').all()
  const existingColumns = new Set(results.map((column) => column.name))
  const requiredColumns = [
    ['province_code', 'TEXT'],
    ['province_name', 'TEXT'],
    ['city_name', 'TEXT'],
  ]

  for (const [columnName, columnType] of requiredColumns) {
    if (existingColumns.has(columnName)) continue
    await db.prepare(`ALTER TABLE checkins ADD COLUMN ${columnName} ${columnType}`).run()
  }
}

export async function getUserById(db, userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
}

export async function updateUser(db, userId, { nickname }) {
  const now = Date.now()
  await db
    .prepare('UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?')
    .bind(nickname, now, userId)
    .run()
}

// Checkins
export async function getCheckinsByUser(db, userId) {
  const { results } = await db
    .prepare('SELECT * FROM checkins WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all()
  return results
}

export async function createCheckin(db, userId, {
  type,
  code,
  name_zh,
  name_en,
  created_at,
  province_code,
  province_name,
  city_name,
}) {
  const id = crypto.randomUUID()
  const now = Number.isFinite(Number(created_at)) ? Number(created_at) : Date.now()
  await db
    .prepare(`
      INSERT INTO checkins (
        id, user_id, type, code, name_zh, name_en, created_at, province_code, province_name, city_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      userId,
      type,
      code,
      name_zh,
      name_en || '',
      now,
      province_code || '',
      province_name || '',
      city_name || ''
    )
    .run()
  return {
    id,
    user_id: userId,
    type,
    code,
    name_zh,
    name_en,
    created_at: now,
    province_code: province_code || '',
    province_name: province_name || '',
    city_name: city_name || '',
  }
}

export async function updateCheckinTimeById(db, id, userId, createdAt) {
  const result = await db
    .prepare('UPDATE checkins SET created_at = ? WHERE id = ? AND user_id = ?')
    .bind(createdAt, id, userId)
    .run()
  return result.meta.changes > 0
}

export async function deleteCheckinById(db, id, userId) {
  const result = await db
    .prepare('DELETE FROM checkins WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()
  return result.meta.changes > 0
}

export async function getPlazaStats(db) {
  const { results } = await db
    .prepare(`
      SELECT 
        u.id,
        u.nickname,
        COUNT(CASE WHEN c.type = 'china_city' THEN 1 END) as china_count,
        COUNT(CASE WHEN c.type = 'world_country' THEN 1 END) as world_count,
        COUNT(c.id) as total
      FROM users u
      LEFT JOIN checkins c ON c.user_id = u.id
      GROUP BY u.id
      ORDER BY total DESC
      LIMIT 50
    `)
    .all()
  return results
}
