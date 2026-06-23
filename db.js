const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'pantis.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    userId TEXT,
    userName TEXT,
    antal INTEGER NOT NULL,
    typ TEXT NOT NULL,
    description TEXT,
    pantVarde INTEGER NOT NULL,
    location TEXT NOT NULL,
    contact TEXT NOT NULL,
    image TEXT,
    reserved INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_listings (
    orderId TEXT NOT NULL,
    listingId TEXT NOT NULL,
    PRIMARY KEY (orderId, listingId)
  );
`)

function toRow(row) {
  if (!row) return null
  return { ...row, reserved: row.reserved === 1, createdAt: new Date(row.createdAt) }
}

// ─── Users ────────────────────────────────────────
function createUser({ id, name, email, passwordHash }) {
  db.prepare('INSERT INTO users (id, name, email, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, email, passwordHash, new Date().toISOString())
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) || null
}

// ─── Listings ─────────────────────────────────────
function createListing(l) {
  db.prepare(`
    INSERT INTO listings (id, userId, userName, antal, typ, description, pantVarde, location, contact, image, reserved, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(l.id, l.userId, l.userName, l.antal, l.typ, l.description || '', l.pantVarde, l.location, l.contact, l.image || null, new Date().toISOString())
}

function getListing(id) {
  return toRow(db.prepare('SELECT * FROM listings WHERE id = ?').get(id))
}

function getListings({ search, typ } = {}) {
  let query = 'SELECT * FROM listings WHERE reserved = 0'
  const params = []

  if (search) {
    query += ' AND (LOWER(description) LIKE ? OR LOWER(location) LIKE ?)'
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`)
  }
  if (typ) {
    query += ' AND typ = ?'
    params.push(typ)
  }

  query += ' ORDER BY createdAt DESC'
  return db.prepare(query).all(...params).map(toRow)
}

function reserveListing(id) {
  db.prepare('UPDATE listings SET reserved = 1 WHERE id = ?').run(id)
}

function deleteListing(id) {
  db.prepare('DELETE FROM listings WHERE id = ?').run(id)
}

function getListingsByIds(ids) {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(',')
  return db.prepare(`SELECT * FROM listings WHERE id IN (${placeholders})`).all(...ids).map(toRow)
}

function getUserListings(userId) {
  return db.prepare('SELECT * FROM listings WHERE userId = ? ORDER BY createdAt DESC').all(userId).map(toRow)
}

// ─── Orders ───────────────────────────────────────
function createOrder({ id, name, contact, listings }) {
  const created = new Date().toISOString()
  db.prepare('INSERT INTO orders (id, name, contact, createdAt) VALUES (?, ?, ?, ?)').run(id, name, contact, created)
  for (const l of listings) {
    db.prepare('INSERT INTO order_listings (orderId, listingId) VALUES (?, ?)').run(id, l.id)
  }
  return { id, name, contact, listings, createdAt: new Date(created) }
}

module.exports = {
  createUser,
  findUserByEmail,
  createListing,
  getListing,
  getListings,
  reserveListing,
  deleteListing,
  getListingsByIds,
  getUserListings,
  createOrder
}
