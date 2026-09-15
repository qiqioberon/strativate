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

test('Digital Product carousel is portrait, auto-advances after five seconds, and opens product detail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/produk-carousel')

  const viewport = page.locator('.digital-product-carousel__viewport')
  const box = await viewport.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThan(box!.width)
  expect(box!.height / box!.width).toBeGreaterThan(1.2)
  expect(box!.height / box!.width).toBeLessThan(1.3)
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(pageWidth).toBeLessThanOrEqual(390)

  await expect(page.locator('.digital-product-carousel__slide[aria-hidden="false"] h3')).toHaveText('Produk Portrait Satu')
  await expect(page.locator('.digital-product-carousel__slide[aria-hidden="false"] h3')).toHaveText('Produk Portrait Dua', { timeout: 6500 })

  await page.getByTestId('digital-product-detail-link-produk-portrait-dua').click()
  await expect(page).toHaveURL(/\/produk-digital\/produk-portrait-dua$/)
  await expect(page.getByRole('heading', { name: 'Detail Produk' })).toBeVisible()
  await expect(page.getByTestId('fixture-product-slug')).toHaveText('produk-portrait-dua')
})
