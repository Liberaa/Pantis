const express = require('express')
const path = require('path')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const session = require('express-session')
const bcrypt = require('bcryptjs')
const db = require('./db')

const app = express()
const PORT = 3000

const PANT_VALUES = { '1kr': 1, '2kr': 2, '3kr': 3, blandat: 1.5 }

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET || 'pantis-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}))

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null
  next()
})

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
})
const upload = multer({ storage })

function requireAuth(req, res, next) {
  if (req.session.user) return next()
  res.redirect('/loggain?next=' + encodeURIComponent(req.originalUrl))
}

// ─── Feed (home page) ─────────────────────────────
app.get('/', (req, res) => {
  const { search, typ } = req.query
  const listings = db.getListings({ search, typ })
  res.render('index', { listings, search: search || '', typ: typ || '' })
})

app.get('/annonser', (req, res) => res.redirect('/'))

// ─── Single listing ───────────────────────────────
app.get('/annons/:id', (req, res) => {
  const listing = db.getListing(req.params.id)
  if (!listing) return res.redirect('/')
  res.render('listing', { listing })
})

// ─── Delete listing ───────────────────────────────
app.post('/annons/:id/slett', requireAuth, (req, res) => {
  const listing = db.getListing(req.params.id)
  if (!listing) return res.redirect('/')
  if (listing.userId !== req.session.user.id) return res.redirect('/')
  db.deleteListing(listing.id)
  res.redirect('/')
})

// ─── Post listing ─────────────────────────────────
app.get('/lämna', requireAuth, (req, res) => {
  res.render('new-listing')
})

app.post('/lämna', requireAuth, upload.single('image'), (req, res) => {
  const { antal, typ, description, location, contact } = req.body
  const antalNum = parseInt(antal) || 1
  const listing = {
    id: uuidv4(),
    userId: req.session.user.id,
    userName: req.session.user.name,
    antal: antalNum,
    typ,
    description,
    pantVarde: Math.round(antalNum * (PANT_VALUES[typ] || 1)),
    location,
    contact,
    image: req.file ? `/uploads/${req.file.filename}` : null
  }
  db.createListing(listing)
  res.redirect(`/annons/${listing.id}`)
})

// ─── API ──────────────────────────────────────────
app.get('/api/listings', (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : []
  res.json(db.getListingsByIds(ids))
})

// ─── Cart & checkout ──────────────────────────────
app.get('/varukorg', (req, res) => res.render('cart'))
app.get('/kassa', (req, res) => res.render('checkout'))

app.post('/kassa', (req, res) => {
  const { name, contact, ids } = req.body
  const idList = Array.isArray(ids) ? ids : [ids].filter(Boolean)
  const picked = db.getListingsByIds(idList)
  picked.forEach(l => db.reserveListing(l.id))
  const order = db.createOrder({ id: uuidv4(), name, contact, listings: picked })
  res.render('confirmation', { order })
})

// ─── Auth ─────────────────────────────────────────
app.get('/loggain', (req, res) => {
  if (req.session.user) return res.redirect('/')
  res.render('login', { error: null, next: req.query.next || '/' })
})

app.post('/loggain', async (req, res) => {
  const { email, password, next } = req.body
  const user = db.findUserByEmail(email)
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
  if (db.findUserByEmail(email)) {
    return res.render('register', { error: 'Det finns redan ett konto med den e-postadressen.' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = { id: uuidv4(), name: name.trim(), email: email.toLowerCase().trim(), passwordHash }
  db.createUser(user)
  req.session.user = { id: user.id, name: user.name, email: user.email }
  res.redirect('/')
})

app.post('/logout', (req, res) => {
  req.session.destroy()
  res.redirect('/')
})

// ─── Profile ──────────────────────────────────────
app.get('/profil', requireAuth, (req, res) => {
  const myListings = db.getUserListings(req.session.user.id)
  res.render('profile', { listings: myListings })
})

// ─── Static pages ─────────────────────────────────
app.get('/hur-fungerar-det', (req, res) => res.render('how-to-use'))
app.get('/villkor', (req, res) => res.render('terms'))

// ─── 404 ──────────────────────────────────────────
app.use((req, res) => res.status(404).render('404'))

app.listen(PORT, () => {
  console.log(`Pantis körs på http://localhost:${PORT}`)
})
