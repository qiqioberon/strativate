import { expect, test, type Page, type Route } from '@playwright/test'

type DigitalProduct = {
  id: string
  name: string
  slug: string
  description: string
  image_path: string
  price_amount: number
  content_type: 'pdf' | 'video' | null
  content_path: string | null
  content_mime_type: string | null
  content_file_name: string | null
  content_size_bytes: number | null
  page_count: number | null
  duration_seconds: number | null
  is_published: boolean
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
  content_type: null,
  content_path: null,
  content_mime_type: null,
  content_file_name: null,
  content_size_bytes: null,
  page_count: null,
  duration_seconds: null,
  is_published: false,
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

test('Digital Product table opens edit flow in a modal instead of an inline editor', async ({ page }) => {
  await mockDigitalProductBackend(page, [
    product('one', 'Business Case Handbook', 'business-case-handbook', 75000),
    product('two', 'Pitching Guide', 'pitching-guide', 50000),
  ])
  await openDigitalProducts(page)

  await expect(page.getByRole('heading', { name: 'Digital Products' })).toBeVisible()
  await expect(page.getByTestId('digital-product-table')).toBeVisible()
  await expect(page.getByTestId('digital-product-edit-mode')).toHaveCount(0)

  const handbookRow = page.getByTestId('digital-product-row').filter({ hasText: 'Business Case Handbook' })
  await expect(handbookRow).toContainText('Rp75.000')
  await handbookRow.getByRole('button', { name: 'Kelola' }).click()
  await expect(page.getByTestId('digital-product-dialog')).toBeVisible()
  await expect(page.getByTestId('digital-product-edit-mode')).toBeVisible()
  await expect(page.getByTestId('digital-product-dialog')).toContainText('Business Case Handbook')
  await page.getByTestId('digital-product-dialog-close').click()
  await expect(page.getByTestId('digital-product-dialog')).toHaveCount(0)

  const search = page.getByLabel('Cari produk')
  await search.fill('Pitching')
  await expect(page.getByTestId('digital-product-row').filter({ hasText: 'Pitching Guide' })).toBeVisible()
  await expect(page.getByTestId('digital-product-row').filter({ hasText: 'Business Case Handbook' })).toHaveCount(0)
})

test('Digital Product table exposes numbered pagination', async ({ page }) => {
  const products = Array.from({ length: 12 }, (_, index) => product(
    `product-${index + 1}`,
    `Product ${String(index + 1).padStart(2, '0')}`,
    `product-${index + 1}`,
    10000 + index,
  ))
  await mockDigitalProductBackend(page, products)
  await openDigitalProducts(page)

  await expect(page.getByRole('button', { name: 'Halaman 1' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Halaman 2' })).toBeVisible()
  await expect(page.getByTestId('digital-product-row')).toHaveCount(10)

  await page.getByRole('button', { name: 'Halaman 2' }).click()
  await expect(page.getByRole('button', { name: 'Halaman 2' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('digital-product-row')).toHaveCount(2)
  await expect(page.getByTestId('digital-product-row').filter({ hasText: 'Product 11' })).toBeVisible()
})

test('zero products use dedicated onboarding and the primary CTA opens create modal', async ({ page }) => {
  await mockDigitalProductBackend(page, [])
  await openDigitalProducts(page)

  const emptyState = page.getByTestId('digital-product-empty-state')
  await expect(emptyState).toBeVisible()
  await expect(emptyState.getByRole('heading', { name: 'Belum ada Digital Product' })).toBeVisible()
  await emptyState.getByRole('button', { name: 'Buat Digital Product' }).click()

  await expect(page.getByTestId('digital-product-dialog')).toBeVisible()
  await expect(page.getByTestId('digital-product-create-mode')).toBeVisible()
  await page.getByTestId('digital-product-name-input').fill('Business Case Workbook')
  await expect(page.getByTestId('digital-product-slug-input')).toHaveValue('business-case-workbook')
  await page.getByTestId('digital-product-slug-input').fill('custom-workbook')
  await page.getByTestId('digital-product-name-input').fill('Business Case Workbook Revised')
  await expect(page.getByTestId('digital-product-slug-input')).toHaveValue('custom-workbook')
})

test('Digital Product table and modal stay page-overflow safe at desktop and mobile widths', async ({ page }) => {
  await mockDigitalProductBackend(page, [product('one', 'Business Case Handbook', 'business-case-handbook-with-a-long-slug', 75000)])
  await page.setViewportSize({ width: 1440, height: 900 })
  await openDigitalProducts(page)

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await expect(page.getByTestId('digital-product-table-scroll')).toBeVisible()

    await page.getByTestId('digital-product-row').getByRole('button', { name: 'Kelola' }).click()
    await expect(page.getByTestId('digital-product-dialog')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.getByTestId('digital-product-dialog-close').click()
  }
})

test('public Digital Products storefront remains disabled', async ({ page }) => {
  await page.goto('/produk-digital')
  await expect(page).toHaveURL(/\/program(?:\?.*)?$/)
})
