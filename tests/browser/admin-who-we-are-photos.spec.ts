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

async function mockBackend(
  page: Page,
  rows: Photo[],
  mutations: Array<{ method: string; body: unknown }> = [],
) {
  await page.route('**/rest/v1/homepage_who_we_are_photos*', async route => {
    if (route.request().method() === 'GET') return json(route, rows)
    mutations.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
    })
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


test('extreme replacement aspect ratio stays clipped to the crop preview', async ({ page }) => {
  await mockBackend(page, [])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:3001/admin')

  await page.getByRole('button', { name: 'Who We Are Photos' }).click()
  const manager = page.getByTestId('who-we-are-photo-admin-section')
  await manager.getByRole('button', { name: 'Manage' }).first().click()

  const dialog = page.getByTestId('who-we-are-photo-editor-dialog')
  const fileInput = dialog.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'extreme-wide.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="300"><rect width="2000" height="300" fill="black"/></svg>'),
  })

  await expect(dialog.getByText('Horizontal position')).toBeVisible()
  const previewImage = dialog.locator('img[draggable="false"]')
  await expect(previewImage).toBeVisible()

  const previewContract = await previewImage.evaluate(image => {
    const preview = image.parentElement!
    const previewBox = preview.getBoundingClientRect()
    const samplePoints = [
      { x: Math.max(1, previewBox.left - 12), y: previewBox.top + previewBox.height / 2 },
      { x: previewBox.left + previewBox.width / 2, y: Math.max(1, previewBox.top - 12) },
    ]
    return {
      position: getComputedStyle(preview).position,
      overflow: getComputedStyle(preview).overflow,
      leaksOutsideFrame: samplePoints.some(point => document.elementFromPoint(point.x, point.y) === image),
    }
  })

  expect(previewContract.position).toBe('relative')
  expect(previewContract.overflow).toBe('hidden')
  expect(previewContract.leaksOutsideFrame).toBe(false)
})


test('editing an existing slot PATCHes mutable fields without resending its fixed role', async ({ page }) => {
  const mutations: Array<{ method: string; body: unknown }> = []
  const storedPath = 'who-we-are/primary/a2800000-0000-4000-8000-000000000001.webp'
  await mockBackend(page, [{
    role: 'primary',
    image_path: storedPath,
    alt_text: 'Students preparing a competition presentation',
    badge_text: 'Collaborative preparation',
    created_at: '2026-09-28T00:00:00.000Z',
    updated_at: '2026-09-28T00:00:00.000Z',
  }], mutations)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:3001/admin')

  await page.getByRole('button', { name: 'Who We Are Photos' }).click()
  const manager = page.getByTestId('who-we-are-photo-admin-section')
  await manager.getByRole('button', { name: 'Manage' }).first().click()

  const dialog = page.getByTestId('who-we-are-photo-editor-dialog')
  await dialog.getByLabel('Badge text (optional)').fill('Updated achievement')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toBeHidden()

  const patch = mutations.find(mutation => mutation.method === 'PATCH')
  expect(patch).toBeTruthy()
  expect(patch?.body).toEqual({
    image_path: storedPath,
    alt_text: 'Students preparing a competition presentation',
    badge_text: 'Updated achievement',
  })
  expect(mutations.some(mutation => mutation.method === 'POST')).toBe(false)
})
