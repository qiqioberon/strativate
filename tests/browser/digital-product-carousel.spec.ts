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
  await page.goto('http://localhost:3001/produk-carousel')

  const swap = page.getByTestId('react-bits-card-swap')
  const cards = page.locator('.digital-product-swap-card')
  await expect(swap).toBeVisible()
  await expect(cards).toHaveCount(2)
  await expect(page.getByTestId('digital-product-card-swap')).toBeVisible()

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(pageWidth).toBeLessThanOrEqual(390)

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
