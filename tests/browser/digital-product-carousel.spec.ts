import { expect, test } from '@playwright/test'

test('mobile marketing burger stays at the far right of the top navigation', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')

  const burger = page.getByTestId('mobile-menu-toggle-button')
  await expect(burger).toBeVisible()
  const box = await burger.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(280)
  expect(box!.x + box!.width).toBeLessThanOrEqual(360)
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(pageWidth).toBeLessThanOrEqual(360)
})

test('Digital Product Card Swap rotates the front product and opens product detail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/produk-carousel?count=2')

  const swap = page.getByTestId('react-bits-card-swap')
  const cards = page.locator('.digital-product-swap-card')
  await expect(swap).toBeVisible()
  await expect(cards).toHaveCount(2)
  await expect(page.getByTestId('digital-product-card-swap')).toBeVisible()

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(pageWidth).toBeLessThanOrEqual(390)

  const dots = page.locator('.digital-product-card-swap__dots')
  const firstCard = cards.first()
  const [dotsBox, firstCardBox] = await Promise.all([dots.boundingBox(), firstCard.boundingBox()])
  expect(dotsBox).not.toBeNull()
  expect(firstCardBox).not.toBeNull()
  expect(dotsBox!.y - (firstCardBox!.y + firstCardBox!.height)).toBeGreaterThanOrEqual(24)

  const frontTitle = async () => cards.evaluateAll(nodes => {
    const ordered = nodes.map(node => ({
      title: node.querySelector('h3')?.textContent ?? '',
      z: Number.parseInt(getComputedStyle(node).zIndex || '0', 10),
    })).sort((a, b) => b.z - a.z)
    return ordered[0]?.title ?? ''
  })

  await expect.poll(frontTitle).toBe('Produk Portrait Satu')

  const firstDot = page.getByTestId('digital-product-card-dot-0')
  const secondDot = page.getByTestId('digital-product-card-dot-1')
  await expect(firstDot).toHaveAttribute('aria-current', 'true')
  await secondDot.click()
  await expect(firstDot).toHaveAttribute('aria-current', 'true')
  await expect.poll(frontTitle, { timeout: 3000 }).toBe('Produk Portrait Dua')
  await expect(secondDot).toHaveAttribute('aria-current', 'true')

  await firstDot.click()
  await expect(secondDot).toHaveAttribute('aria-current', 'true')
  await expect.poll(frontTitle, { timeout: 3000 }).toBe('Produk Portrait Satu')
  await expect(firstDot).toHaveAttribute('aria-current', 'true')

  await expect.poll(frontTitle, { timeout: 5500 }).toBe('Produk Portrait Dua')
  await expect(secondDot).toHaveAttribute('aria-current', 'true')

  await page.getByTestId('digital-product-detail-link-produk-portrait-dua').click()
  await expect(page).toHaveURL(/\/produk-digital\/produk-portrait-dua$/)
  await expect(page.getByRole('heading', { name: 'Detail Produk' })).toBeVisible()
  await expect(page.getByTestId('fixture-product-slug')).toHaveText('produk-portrait-dua')
})

test('Digital Product Card Swap arrows navigate in both directions and wrap around', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/produk-carousel?count=3&motion=reduce')

  const cards = page.locator('.digital-product-swap-card')
  const frontTitle = async () => cards.evaluateAll(nodes => nodes
    .map(node => ({ title: node.querySelector('h3')?.textContent ?? '', z: Number.parseInt(getComputedStyle(node).zIndex || '0', 10) }))
    .sort((a, b) => b.z - a.z)[0]?.title ?? '')

  await expect(cards).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Previous digital product' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next digital product' })).toBeVisible()
  await expect.poll(frontTitle).toBe('Produk Portrait Satu')

  await page.getByRole('button', { name: 'Previous digital product' }).click()
  await expect.poll(frontTitle).toBe('Produk Portrait Tiga')
  await expect(page.getByTestId('digital-product-card-dot-2')).toHaveAttribute('aria-current', 'true')

  await page.getByRole('button', { name: 'Next digital product' }).click()
  await expect.poll(frontTitle).toBe('Produk Portrait Satu')
  await expect(page.getByTestId('digital-product-card-dot-0')).toHaveAttribute('aria-current', 'true')

  await page.getByRole('button', { name: 'Next digital product' }).click()
  await expect.poll(frontTitle).toBe('Produk Portrait Dua')
})

test('Digital Product Card Swap omits unnecessary controls for one product', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/produk-carousel?count=1&motion=reduce')

  await expect(page.locator('.digital-product-swap-card')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Previous digital product' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next digital product' })).toHaveCount(0)
  await expect(page.locator('.digital-product-card-swap__dots')).toHaveCount(0)
  await expect(page.getByTestId('digital-product-detail-link-produk-portrait-satu')).toBeVisible()
})

test('Digital Product Card Swap keeps the full stack inside the viewport at supported counts', async ({ page }) => {
  for (const count of [1, 2, 3, 5]) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`http://localhost:3001/produk-carousel?count=${count}&motion=reduce`)

    const geometry = await page.locator('.digital-product-card-swap').evaluate((stage) => {
      const cards = [...stage.querySelectorAll<HTMLElement>('.digital-product-swap-card')]
      const arrows = [...stage.querySelectorAll<HTMLElement>('.digital-product-card-swap__arrow')]
      const bounds = [...cards, ...arrows].map(element => element.getBoundingClientRect())
      return {
        stage: stage.getBoundingClientRect().toJSON(),
        bounds: bounds.map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })),
        scrollWidth: document.documentElement.scrollWidth,
      }
    })

    expect(geometry.scrollWidth).toBeLessThanOrEqual(390)
    for (const bound of geometry.bounds) {
      expect(bound.left).toBeGreaterThanOrEqual(0)
      expect(bound.right).toBeLessThanOrEqual(390)
      expect(bound.top).toBeGreaterThanOrEqual(geometry.stage.top - 1)
      expect(bound.bottom).toBeLessThanOrEqual(geometry.stage.bottom + 1)
    }
  }
})
