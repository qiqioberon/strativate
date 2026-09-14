import { expect, test, type Page, type Route } from '@playwright/test'

type DigitalProduct = {
  id: string
  name: string
  slug: string
  description: string
  image_path: string
  price_amount: number
  created_at: string
  updated_at: string
}

const product = (id: string, name: string, slug: string, price: number): DigitalProduct => ({
  id,
  name,
  slug,
  description: `${name} description`,
  image_path: `products/${id}.webp`,
  price_amount: price,
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
})

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
}

async function mockDigitalProductBackend(page: Page, products: DigitalProduct[]) {
  await page.route('**/rest/v1/digital_products*', async route => {
    if (route.request().method() === 'GET') return fulfillJson(route, products)
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.route('**/storage/v1/object/sign/digital-product-images/**', async route => {
    if (route.request().method() === 'POST') {
      const pathname = new URL(route.request().url()).pathname
      return fulfillJson(route, { signedURL: `${pathname}?token=fixture` })
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900"><rect width="640" height="900" fill="#171314"/></svg>',
    })
  })
}

async function openDigitalProducts(page: Page) {
  await page.goto('http://localhost:3001/admin')
  await page.getByRole('button', { name: 'Produk Digital' }).click()
  await expect(page.getByTestId('digital-product-management')).toBeVisible()
}

test('admin navigation renders a searchable Digital Product navigator and selected editor', async ({ page }) => {
  await mockDigitalProductBackend(page, [
    product('one', 'Business Case Handbook', 'business-case-handbook', 75000),
    product('two', 'Pitching Guide', 'pitching-guide', 50000),
  ])
  await openDigitalProducts(page)

  await expect(page.getByText('Produk', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Digital Products' })).toBeVisible()
  await expect(page.getByText('Business Case Handbook', { exact: true })).toBeVisible()
  await expect(page.getByText('Rp75.000 · /business-case-handbook', { exact: true })).toBeVisible()
  await expect(page.getByTestId('digital-product-edit-mode')).toBeVisible()

  const search = page.getByLabel('Cari produk')
  await search.fill('Pitching')
  await expect(page.getByText('Pitching Guide', { exact: true })).toBeVisible()
  await expect(page.locator('.catalog-admin-product').filter({ hasText: 'Business Case Handbook' })).toHaveCount(0)

  await page.locator('.catalog-admin-product').filter({ hasText: 'Pitching Guide' }).click()
  await expect(page.getByTestId('digital-product-edit-mode')).toContainText('Pitching Guide')
})

test('zero products use dedicated onboarding and the primary CTA opens create mode', async ({ page }) => {
  await mockDigitalProductBackend(page, [])
  await openDigitalProducts(page)

  const emptyState = page.getByTestId('digital-product-empty-state')
  await expect(emptyState).toBeVisible()
  await expect(emptyState.getByRole('heading', { name: 'Belum ada Digital Product' })).toBeVisible()
  await expect(emptyState.getByRole('button', { name: 'Buat Digital Product' })).toBeVisible()
  await expect(page.getByLabel('Cari produk')).toHaveCount(0)
  await expect(page.locator('.catalog-admin-layout')).toHaveCount(0)

  await emptyState.getByRole('button', { name: 'Buat Digital Product' }).click()
  await expect(page.getByTestId('digital-product-create-mode')).toBeVisible()
  await expect(emptyState).toHaveCount(0)

  await page.getByTestId('digital-product-name-input').fill('Business Case Workbook')
  await expect(page.getByTestId('digital-product-slug-input')).toHaveValue('business-case-workbook')
  await page.getByTestId('digital-product-slug-input').fill('custom-workbook')
  await page.getByTestId('digital-product-name-input').fill('Business Case Workbook Revised')
  await expect(page.getByTestId('digital-product-slug-input')).toHaveValue('custom-workbook')
})

test('Digital Product workspace has no horizontal overflow at desktop, tablet, and mobile widths', async ({ page }) => {
  await mockDigitalProductBackend(page, [product('one', 'Business Case Handbook', 'business-case-handbook-with-a-long-slug', 75000)])
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openDigitalProducts(page)

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await expect(page.getByTestId('digital-product-management')).toBeVisible()
  }
})

test('public Digital Products storefront remains disabled', async ({ page }) => {
  await page.goto('/produk-digital')
  await expect(page).toHaveURL(/\/program(?:\?.*)?$/)
})
