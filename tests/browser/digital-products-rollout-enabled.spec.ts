import { expect, test } from '@playwright/test'

const digitalProductsEnabled = process.env.FEATURE_DIGITAL_PRODUCTS === 'true'

test('enabled Digital Products rollout exposes navigation and keeps the storefront route active', async ({ page }) => {
  test.skip(!digitalProductsEnabled, 'Digital Products public rollout is disabled in this browser target.')

  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Digital Products' })).toBeVisible()

  await page.goto('/produk-digital')
  await expect(page).toHaveURL(/\/produk-digital(?:\?.*)?$/)
  await expect(page.getByRole('heading', { level: 1, name: /Keep learning/i })).toBeVisible()
})
