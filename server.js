const express = require('express')
const path = require('path')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')

const app = express()
const PORT = 3000

const PANT_VALUES = { '1kr': 1, '2kr': 2, '3kr': 3, blandat: 1.5 }

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
})
const upload = multer({ storage })

// In-memory store
const listings = []
const orders = []

app.get('/', (req, res) => {
  const available = listings.filter(l => !l.reserved)
  res.render('index', { listings: available.slice(-9).reverse() })
})

app.get('/annonser', (req, res) => {
  const { search, typ } = req.query
  let results = listings.filter(l => !l.reserved)

  if (search) results = results.filter(l =>
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.location.toLowerCase().includes(search.toLowerCase())
  )
  if (typ) results = results.filter(l => l.typ === typ)

  res.render('listings', { listings: results.reverse(), search, typ })
})

app.get('/annons/:id', (req, res) => {
  const listing = listings.find(l => l.id === req.params.id)
  if (!listing) return res.redirect('/annonser')
  res.render('listing', { listing })
})

app.get('/lämna', (req, res) => {
  res.render('new-listing')
})

app.post('/lämna', upload.single('image'), (req, res) => {
  const { antal, typ, description, location, contact } = req.body
  const antalNum = parseInt(antal) || 1
  const pantVarde = Math.round(antalNum * (PANT_VALUES[typ] || 1))
  const listing = {
    id: uuidv4(),
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

// API — returns listings by comma-separated IDs
app.get('/api/listings', (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : []
  const found = ids.map(id => listings.find(l => l.id === id)).filter(Boolean)
  res.json(found)
})

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

  const order = {
    id: uuidv4(),
    name,
    contact,
    listings: picked,
    createdAt: new Date()
  }
  orders.push(order)
  res.render('confirmation', { order })
})

app.get('/hur-fungerar-det', (req, res) => {
  res.render('how-to-use')
})

app.get('/villkor', (req, res) => {
  res.render('terms')
})

app.listen(PORT, () => {
  console.log(`Pantis körs på http://localhost:${PORT}`)
})
