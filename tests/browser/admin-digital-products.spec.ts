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

test('admin navigation always exposes Digital Products and renders the reusable list/editor screen', async ({ page }) => {
  await mockDigitalProductBackend(page, [
    product('one', 'Business Case Handbook', 'business-case-handbook', 75000),
    product('two', 'Pitching Guide', 'pitching-guide', 50000),
  ])
  await page.goto('http://localhost:3001/admin')

  await expect(page.getByText('Produk', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Digital Products' }).click()
  await expect(page.getByTestId('digital-product-management')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Digital Products' })).toBeVisible()
  await expect(page.getByText('Business Case Handbook', { exact: true })).toBeVisible()
  await expect(page.getByText('Rp75.000 · /business-case-handbook', { exact: true })).toBeVisible()
  await expect(page.getByTestId('digital-product-edit-mode')).toBeVisible()

  const search = page.getByLabel('Cari')
  await search.fill('Pitching')
  await expect(page.getByText('Pitching Guide', { exact: true })).toBeVisible()
  await expect(page.locator('.catalog-admin-product').filter({ hasText: 'Business Case Handbook' })).toHaveCount(0)
})

test('create mode generates an initial slug but preserves an explicit admin override', async ({ page }) => {
  await mockDigitalProductBackend(page, [])
  await page.goto('http://localhost:3001/admin')
  await page.getByRole('button', { name: 'Digital Products' }).click()

  await expect(page.getByTestId('digital-product-empty-editor')).toBeVisible()
  await page.getByRole('button', { name: 'Digital Product baru' }).click()
  await expect(page.getByTestId('digital-product-create-mode')).toBeVisible()

  await page.getByTestId('digital-product-name-input').fill('Business Case Workbook')
  await expect(page.getByTestId('digital-product-slug-input')).toHaveValue('business-case-workbook')
  await page.getByTestId('digital-product-slug-input').fill('custom-workbook')
  await page.getByTestId('digital-product-name-input').fill('Business Case Workbook Revised')
  await expect(page.getByTestId('digital-product-slug-input')).toHaveValue('custom-workbook')
})

test('public Digital Products storefront remains disabled', async ({ page }) => {
  await page.goto('/produk-digital')
  await expect(page).toHaveURL(/\/program(?:\?.*)?$/)
})
