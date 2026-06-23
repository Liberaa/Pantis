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

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
})
const upload = multer({ storage })

// In-memory store
const listings = []

app.get('/', (req, res) => {
  res.render('index', { listings: listings.slice(-9).reverse() })
})

app.get('/annonser', (req, res) => {
  const { search, typ } = req.query
  let results = [...listings]

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
    createdAt: new Date()
  }
  listings.push(listing)
  res.redirect(`/annons/${listing.id}`)
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
