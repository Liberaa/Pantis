const express = require('express')
const path = require('path')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')

const app = express()
const PORT = 3000

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
  res.render('index', { listings: listings.slice(-6).reverse() })
})

app.get('/annonser', (req, res) => {
  const { search, size, condition, priceType } = req.query
  let results = [...listings]

  if (search) results = results.filter(l => l.title.toLowerCase().includes(search.toLowerCase()) || l.description.toLowerCase().includes(search.toLowerCase()))
  if (size) results = results.filter(l => l.size === size)
  if (condition) results = results.filter(l => l.condition === condition)
  if (priceType === 'free') results = results.filter(l => l.free)
  if (priceType === 'paid') results = results.filter(l => !l.free)

  res.render('listings', { listings: results.reverse(), search, size, condition, priceType })
})

app.get('/annons/:id', (req, res) => {
  const listing = listings.find(l => l.id === req.params.id)
  if (!listing) return res.redirect('/annonser')
  res.render('listing', { listing })
})

app.get('/sälj', (req, res) => {
  res.render('new-listing')
})

app.post('/sälj', upload.single('image'), (req, res) => {
  const { title, description, price, free, size, condition, location, contact } = req.body
  const listing = {
    id: uuidv4(),
    title,
    description,
    price: free === 'on' ? 0 : parseInt(price) || 0,
    free: free === 'on',
    size,
    condition,
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
