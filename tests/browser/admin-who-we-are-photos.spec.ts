import { expect, test, type Page, type Route } from '@playwright/test'

type Photo = {
  role: 'primary' | 'upper_right' | 'lower_right'
  image_path: string | null
  alt_text: string | null
  badge_text: string | null
  created_at: string
  updated_at: string
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
}

async function mockBackend(page: Page, rows: Photo[]) {
  await page.route('**/rest/v1/homepage_who_we_are_photos*', async route => {
    if (route.request().method() === 'GET') return json(route, rows)
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.route('**/storage/v1/object/public/marketing-editorial/who-we-are/**', route => (
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#d96c31"/></svg>',
    })
  ))
}

test('admin exposes exactly three compact fixed slots and a focused responsive editor', async ({ page }) => {
  await mockBackend(page, [{
    role: 'primary',
    image_path: 'who-we-are/primary/a2800000-0000-4000-8000-000000000001.webp',
    alt_text: 'Students preparing a competition presentation',
    badge_text: 'Collaborative preparation',
    created_at: '2026-09-28T00:00:00.000Z',
    updated_at: '2026-09-28T00:00:00.000Z',
  }])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/admin')

  await page.getByRole('button', { name: 'Buka menu admin' }).click()
  await page.getByRole('button', { name: 'Who We Are Photos' }).click()
  const manager = page.getByTestId('who-we-are-photo-admin-section')
  await expect(manager).toBeVisible()
  await expect(manager.getByTestId('who-we-are-photo-admin-row')).toHaveCount(3)
  await expect(manager.getByText('Primary photo', { exact: true })).toBeVisible()
  await expect(manager.getByText('Upper-right photo', { exact: true })).toBeVisible()
  await expect(manager.getByText('Lower-right photo', { exact: true })).toBeVisible()
  await expect(manager.getByText('No badge', { exact: true })).toHaveCount(2)
  await expect(manager.getByText('Ready', { exact: true })).toHaveCount(1)
  await expect(manager.getByText('Empty', { exact: true })).toHaveCount(2)
  await expect(manager.getByRole('button', { name: 'Manage' })).toHaveCount(3)

  await manager.getByRole('button', { name: 'Manage' }).first().click()
  const dialog = page.getByTestId('who-we-are-photo-editor-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Alt text')).toHaveValue('Students preparing a competition presentation')
  await expect(dialog.getByLabel('Badge text (optional)')).toHaveValue('Collaborative preparation')
  await expect(dialog.getByRole('button', { name: 'Remove photo' })).toBeVisible()
  await expect(dialog.getByText('Horizontal position')).toHaveCount(0)
  await expect(dialog.getByText('Zoom', { exact: true })).toHaveCount(0)
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)

  await dialog.getByRole('button', { name: 'Close photo editor' }).click()
  await expect(dialog).toBeHidden()
})
