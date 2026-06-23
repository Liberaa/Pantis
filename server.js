const express = require('express')
const path = require('path')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const session = require('express-session')
const bcrypt = require('bcryptjs')

const app = express()
const PORT = 3000

const PANT_VALUES = { '1kr': 1, '2kr': 2, '3kr': 3, blandat: 1.5 }

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(session({
  secret: 'pantis-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}))

// Make current user available in all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null
  next()
})

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
})
const upload = multer({ storage })

// In-memory stores
const users = []
const listings = []
const orders = []

function requireAuth(req, res, next) {
  if (req.session.user) return next()
  res.redirect('/loggain?next=' + encodeURIComponent(req.originalUrl))
}

// ─── Feed (home page) ─────────────────────────────
app.get('/', (req, res) => {
  const { search, typ } = req.query
  let results = listings.filter(l => !l.reserved)

  if (search) results = results.filter(l =>
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.location.toLowerCase().includes(search.toLowerCase())
  )
  if (typ) results = results.filter(l => l.typ === typ)

  res.render('index', { listings: results.reverse(), search: search || '', typ: typ || '' })
})

// Keep old URL working
app.get('/annonser', (req, res) => res.redirect('/'))

// ─── Single listing ───────────────────────────────
app.get('/annons/:id', (req, res) => {
  const listing = listings.find(l => l.id === req.params.id)
  if (!listing) return res.redirect('/')
  res.render('listing', { listing })
})

// ─── Post listing ─────────────────────────────────
app.get('/lämna', requireAuth, (req, res) => {
  res.render('new-listing')
})

app.post('/lämna', requireAuth, upload.single('image'), (req, res) => {
  const { antal, typ, description, location, contact } = req.body
  const antalNum = parseInt(antal) || 1
  const pantVarde = Math.round(antalNum * (PANT_VALUES[typ] || 1))
  const listing = {
    id: uuidv4(),
    userId: req.session.user.id,
    userName: req.session.user.name,
    antal: antalNum,
    typ,
    description,
    pantVarde,
    location,
    contact,
    image: req.file ? `/uploads/${req.file.filename}` : null,
    reserved: false,
    createdAt: new Date()
  }
  listings.push(listing)
  res.redirect(`/annons/${listing.id}`)
})

// ─── API ──────────────────────────────────────────
app.get('/api/listings', (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : []
  const found = ids.map(id => listings.find(l => l.id === id)).filter(Boolean)
  res.json(found)
})

// ─── Cart & checkout ──────────────────────────────
app.get('/varukorg', (req, res) => {
  res.render('cart')
})

app.get('/kassa', (req, res) => {
  res.render('checkout')
})

app.post('/kassa', (req, res) => {
  const { name, contact, ids } = req.body
  const idList = Array.isArray(ids) ? ids : [ids].filter(Boolean)
  const picked = idList.map(id => listings.find(l => l.id === id)).filter(Boolean)
  picked.forEach(l => { l.reserved = true })
  const order = { id: uuidv4(), name, contact, listings: picked, createdAt: new Date() }
  orders.push(order)
  res.render('confirmation', { order })
})

// ─── Auth ─────────────────────────────────────────
app.get('/loggain', (req, res) => {
  if (req.session.user) return res.redirect('/')
  res.render('login', { error: null, next: req.query.next || '/' })
})

app.post('/loggain', async (req, res) => {
  const { email, password, next } = req.body
  const user = users.find(u => u.email === email.toLowerCase().trim())
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.render('login', { error: 'Fel e-post eller lösenord.', next: next || '/' })
  }
  req.session.user = { id: user.id, name: user.name, email: user.email }
  res.redirect(next || '/')
})

app.get('/registrera', (req, res) => {
  if (req.session.user) return res.redirect('/')
  res.render('register', { error: null })
})

app.post('/registrera', async (req, res) => {
  const { name, email, password } = req.body
  if (users.find(u => u.email === email.toLowerCase().trim())) {
    return res.render('register', { error: 'Det finns redan ett konto med den e-postadressen.' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = { id: uuidv4(), name: name.trim(), email: email.toLowerCase().trim(), passwordHash }
  users.push(user)
  req.session.user = { id: user.id, name: user.name, email: user.email }
  res.redirect('/')
})

app.post('/logout', (req, res) => {
  req.session.destroy()
  res.redirect('/')
})

// ─── Static pages ─────────────────────────────────
app.get('/hur-fungerar-det', (req, res) => res.render('how-to-use'))
app.get('/villkor', (req, res) => res.render('terms'))

app.listen(PORT, () => {
  console.log(`Pantis körs på http://localhost:${PORT}`)
})
