function getCart() {
  try {
    return JSON.parse(localStorage.getItem('pantis_cart') || '[]')
  } catch {
    return []
  }
}

function saveCart(ids) {
  localStorage.setItem('pantis_cart', JSON.stringify(ids))
  updateCartCount()
}

function addToCart(id) {
  const cart = getCart()
  if (!cart.includes(id)) cart.push(id)
  saveCart(cart)
}

function removeFromCart(id) {
  saveCart(getCart().filter(i => i !== id))
}

function clearCart() {
  localStorage.removeItem('pantis_cart')
  updateCartCount()
}

function isInCart(id) {
  return getCart().includes(id)
}

function toggleCart(id, btn) {
  if (isInCart(id)) {
    removeFromCart(id)
  } else {
    addToCart(id)
  }
  updateCartBtn(id, btn)
}

function updateCartBtn(id, btn) {
  if (!btn) return
  if (isInCart(id)) {
    btn.textContent = '✓ I hämtlistan'
    btn.classList.add('btn-in-cart')
  } else {
    btn.textContent = 'Lägg i hämtlista'
    btn.classList.remove('btn-in-cart')
  }
}

function updateCartCount() {
  const count = getCart().length
  const el = document.getElementById('cart-count')
  if (!el) return
  if (count > 0) {
    el.textContent = count
    el.style.display = 'inline-flex'
  } else {
    el.style.display = 'none'
  }
}

updateCartCount()
