import { expect, test, type Page, type Route } from '@playwright/test'

const viewports = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const

const expertise = [
  { id: '82000000-0000-0000-0000-000000000002', name: 'Business Plan', slug: 'business-plan', sort_order: 20, is_active: true, created_at: '2026-09-17T00:00:00.000Z', updated_at: '2026-09-17T00:00:00.000Z' },
  { id: '82000000-0000-0000-0000-000000000003', name: 'Business Case', slug: 'business-case', sort_order: 30, is_active: true, created_at: '2026-09-17T00:00:00.000Z', updated_at: '2026-09-17T00:00:00.000Z' },
  { id: '82000000-0000-0000-0000-000000000005', name: 'Finance', slug: 'finance', sort_order: 50, is_active: false, created_at: '2026-09-17T00:00:00.000Z', updated_at: '2026-09-17T00:00:00.000Z' },
]

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
}

async function mockExpertiseBackend(page: Page) {
  await page.route('**/rest/v1/mentor_expertise*', route => fulfillJson(route, expertise))
  await page.route('**/rest/v1/rpc/admin_upsert_mentor_expertise', async route => {
    const body = route.request().postDataJSON() as { p_id?: string | null; p_name: string; p_is_active: boolean; p_sort_order?: number | null }
    const existing = expertise.find(item => item.id === body.p_id)
    return fulfillJson(route, existing ? { ...existing, name: body.p_name, is_active: body.p_is_active } : {
      id: '82000000-0000-0000-0000-000000000099',
      name: body.p_name,
      slug: body.p_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      sort_order: body.p_sort_order ?? 60,
      is_active: body.p_is_active,
      created_at: '2026-09-17T00:00:00.000Z',
      updated_at: '2026-09-17T00:00:00.000Z',
    })
  })
  await page.route('**/rest/v1/rpc/admin_reorder_mentor_expertise', route => fulfillJson(route, expertise))
  await page.route('**/rest/v1/rpc/admin_delete_mentor_expertise', route => fulfillJson(route, 'deactivate_required'))
}

async function openExpertise(page: Page) {
  await page.goto('http://localhost:3001/admin')
  const mobileMenu = page.getByRole('button', { name: 'Buka menu admin' })
  if (await mobileMenu.isVisible()) await mobileMenu.click()
  await page.getByRole('button', { name: 'Mentor Expertise' }).click()
  await expect(page.getByTestId('mentor-expertise-management')).toBeVisible()
}

test('Mentor Expertise management and dialog remain overflow-safe at every required viewport', async ({ page }) => {
  await mockExpertiseBackend(page)

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await openExpertise(page)
    await expect(page.getByTestId('mentor-expertise-row-business-plan')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.getByRole('button', { name: 'Tambah expertise' }).click()
    const dialog = page.getByTestId('mentor-expertise-dialog')
    await expect(dialog).toHaveAttribute('open', '')
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Tutup dialog' }).click()
  }
})

test('Mentor Expertise filters status and uses modal create/edit controls', async ({ page }) => {
  await mockExpertiseBackend(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openExpertise(page)

  await page.getByLabel('Status').selectOption('inactive')
  await expect(page.getByTestId('mentor-expertise-row-finance')).toBeVisible()
  await expect(page.getByTestId('mentor-expertise-row-business-case')).toHaveCount(0)

  await page.getByLabel('Status').selectOption('all')
  await page.getByRole('button', { name: 'Tambah expertise' }).click()
  const dialog = page.getByTestId('mentor-expertise-dialog')
  await dialog.getByLabel('Nama expertise').fill('Market Sizing')
  await dialog.getByRole('button', { name: 'Simpan' }).click()
  await expect(page.getByRole('status')).toContainText('Expertise berhasil ditambahkan')

  await page.getByTestId('mentor-expertise-row-business-case').getByRole('button', { name: 'Edit' }).click()
  await expect(dialog).toHaveAttribute('open', '')
  await expect(dialog.getByLabel('Stable slug')).toHaveValue('business-case')
  await dialog.getByRole('button', { name: 'Batal' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
