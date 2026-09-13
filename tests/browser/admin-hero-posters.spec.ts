import { expect, test, type Page, type Route } from '@playwright/test'

type Poster = {
  id: string
  image_path: string
  alt_text: string
  title: string | null
  url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const makePoster = (id: string, active: boolean, order: number): Poster => ({
  id,
  image_path: `posters/${id}.webp`,
  alt_text: `Deskripsi poster ${id}`,
  title: `Poster ${id}`,
  url: id === 'one' ? '/program' : null,
  sort_order: order,
  is_active: active,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
})

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
}

async function mockPosterBackend(page: Page, initial: Poster[]) {
  let posters = [...initial]
  const calls: Array<{ method: string; url: string; body: unknown }> = []

  await page.route('**/storage/v1/object/public/marketing-hero-posters/**', async route => {
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#171314"/></svg>' })
  })
  await page.route('**/rest/v1/rpc/reorder_marketing_hero_posters', async route => {
    const body = route.request().postDataJSON() as { p_ids: string[] }
    calls.push({ method: route.request().method(), url: route.request().url(), body })
    posters = body.p_ids.map((id, index) => ({ ...posters.find(item => item.id === id)!, sort_order: (index + 1) * 10 }))
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.route('**/rest/v1/marketing_hero_posters*', async route => {
    const request = route.request()
    if (request.method() === 'GET') return fulfillJson(route, posters)
    const body = request.postDataJSON() as Partial<Poster>
    calls.push({ method: request.method(), url: request.url(), body })
    const id = new URL(request.url()).searchParams.get('id')?.replace('eq.', '')
    if (request.method() === 'PATCH' && id) posters = posters.map(item => item.id === id ? { ...item, ...body } : item)
    if (request.method() === 'DELETE' && id) posters = posters.filter(item => item.id !== id)
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
  })

  return { calls, posters: () => posters }
}

test('main admin navigation opens Hero Posters and closes the mobile sidebar', async ({ page }) => {
  await mockPosterBackend(page, [])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/admin')

  await page.getByRole('button', { name: 'Buka menu admin' }).click()
  await expect(page.getByText('Konten', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hero Posters' }).click()
  await expect(page.getByTestId('hero-poster-admin-section')).toBeVisible()
  await expect(page.locator('.role-sidebar')).not.toHaveClass(/open/)
  await expect(page.locator('.role-scrim')).toHaveCount(0)
})

test('empty manager reports fallback readiness and preserves the marketing deep link', async ({ page }) => {
  await mockPosterBackend(page, [])
  await page.goto('http://localhost:3001/admin/marketing')

  await expect(page.getByRole('link', { name: 'Kembali ke dashboard admin' })).toHaveAttribute('href', '/admin')
  await expect(page.getByText('Fallback aktif', { exact: true })).toBeVisible()
  await expect(page.getByText('Beranda masih menggunakan visual brand bawaan.')).toBeVisible()
  await expect(page.getByTestId('hero-poster-total-count')).toHaveText('0')
  await expect(page.getByTestId('hero-poster-active-count')).toHaveText('0')
  await expect(page.getByTestId('hero-poster-inactive-count')).toHaveText('0')
})

test('PGRST205 shows an actionable setup-required state and retries safely', async ({ page }) => {
  let attempts = 0
  await page.route('**/rest/v1/marketing_hero_posters*', async route => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
      return
    }
    attempts += 1
    if (attempts === 1) return fulfillJson(route, { code: 'PGRST205', message: "Could not find the table 'public.marketing_hero_posters'" }, 404)
    await fulfillJson(route, [])
  })
  await page.goto('http://localhost:3001/admin/marketing')

  await expect(page.getByText('Setup database diperlukan', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hero Poster belum aktif di database.' })).toBeVisible()
  await expect(page.getByText('202609120001_marketing_hero_posters.sql', { exact: false })).toBeVisible()
  await expect(page.getByText(/homepage tetap menggunakan fallback/i)).toBeVisible()
  const attemptsBeforeRetry = attempts
  await page.getByRole('button', { name: 'Coba lagi' }).click()
  await expect(page.getByText('Fallback aktif', { exact: true })).toBeVisible()
  expect(attempts).toBeGreaterThan(attemptsBeforeRetry)
})

test('unknown load failures stay safe and provide retry without a misleading readiness state', async ({ page }) => {
  await page.route('**/rest/v1/marketing_hero_posters*', route => fulfillJson(route, { code: 'XX500', message: 'private database detail' }, 500))
  await page.goto('http://localhost:3001/admin/marketing')

  await expect(page.getByTestId('hero-poster-error-message')).toContainText('Hero poster belum dapat dimuat. Periksa koneksi lalu coba lagi.')
  await expect(page.getByText('private database detail')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible()
  await expect(page.getByText('Fallback aktif', { exact: true })).toHaveCount(0)
})

test('editing keeps the stored image, quick status uses PATCH, and ordering uses the RPC', async ({ page }) => {
  const backend = await mockPosterBackend(page, [makePoster('one', true, 10), makePoster('two', false, 20)])
  await page.goto('http://localhost:3001/admin/marketing')

  const first = page.getByTestId('hero-poster-row-one')
  const second = page.getByTestId('hero-poster-row-two')
  await expect(first.getByRole('button', { name: 'Naikkan Poster one' })).toBeDisabled()
  await expect(second.getByRole('button', { name: 'Turunkan Poster two' })).toBeDisabled()

  await first.getByRole('switch', { name: 'Nonaktifkan Poster one' }).click()
  await expect(first.locator('.hero-poster-status').getByText('Nonaktif', { exact: true })).toBeVisible()
  expect(backend.calls.some(call => call.method === 'PATCH' && (call.body as Partial<Poster>).is_active === false)).toBe(true)

  await second.getByRole('button', { name: 'Naikkan Poster two' }).click()
  expect(backend.calls.some(call => call.url.includes('/rpc/reorder_marketing_hero_posters') && JSON.stringify(call.body) === JSON.stringify({ p_ids: ['two', 'one'] }))).toBe(true)

  await page.getByTestId('hero-poster-one-edit-button').click()
  await expect(page.getByText('Sedang mengedit Poster one')).toBeVisible()
  await page.getByTestId('hero-poster-alt-input').fill('Deskripsi yang diperbarui')
  await page.getByTestId('hero-poster-save-button').click()
  const editCall = backend.calls.findLast(call => call.method === 'PATCH' && (call.body as Partial<Poster>).alt_text === 'Deskripsi yang diperbarui')
  expect(editCall?.body).toMatchObject({ image_path: 'posters/one.webp' })
  await expect(page.getByText('Poster berhasil diperbarui.')).toBeVisible()
})

test('failed quick status writes keep server state and show safe feedback', async ({ page }) => {
  await mockPosterBackend(page, [makePoster('one', true, 10)])
  await page.route('**/rest/v1/marketing_hero_posters*', async route => {
    if (route.request().method() === 'PATCH') return fulfillJson(route, { code: 'XX500', message: 'private database detail' }, 500)
    await route.fallback()
  })
  await page.goto('http://localhost:3001/admin/marketing')

  const first = page.getByTestId('hero-poster-row-one')
  await first.getByRole('switch', { name: 'Nonaktifkan Poster one' }).click()
  await expect(page.getByTestId('hero-poster-error-message')).toContainText('Permintaan gagal. Periksa koneksi dan coba lagi.')
  await expect(page.getByText('private database detail')).toHaveCount(0)
  await expect(first.getByRole('switch', { name: 'Nonaktifkan Poster one' })).toHaveAttribute('aria-checked', 'true')
})

test('delete removes the database row first and warns when Storage cleanup fails', async ({ page }) => {
  const backend = await mockPosterBackend(page, [makePoster('one', true, 10)])
  await page.route('**/storage/v1/object/marketing-hero-posters/**', route => fulfillJson(route, { message: 'storage unavailable' }, 500))
  page.on('dialog', dialog => void dialog.accept())
  await page.goto('http://localhost:3001/admin/marketing')

  await page.getByTestId('hero-poster-one-delete-button').click()
  await expect(page.getByText('Poster dihapus dari daftar, tetapi berkas Storage perlu ditinjau manual.')).toBeVisible()
  await expect(page.getByTestId('hero-poster-empty-state')).toBeVisible()
  expect(backend.calls.some(call => call.method === 'DELETE' && call.url.includes('id=eq.one'))).toBe(true)
})

test('form validates content and revokes replacement previews when editing is cancelled', async ({ page }) => {
  await mockPosterBackend(page, [makePoster('one', true, 10)])
  await page.addInitScript(() => {
    const created: string[] = []
    const revoked: string[] = []
    Object.defineProperty(window, '__previewLifecycle', { value: { created, revoked } })
    URL.createObjectURL = () => {
      const value = `blob:fixture-${created.length + 1}`
      created.push(value)
      return value
    }
    URL.revokeObjectURL = value => revoked.push(value)
  })
  await page.goto('http://localhost:3001/admin/marketing')

  await page.getByTestId('hero-poster-one-edit-button').click()
  await page.getByTestId('hero-poster-file-input').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: Buffer.from('replacement') })
  await expect(page.getByTestId('hero-poster-preview')).toHaveAttribute('data-preview-source', 'local')
  await page.getByTestId('hero-poster-cancel-button').click()
  const lifecycle = await page.evaluate(() => (window as typeof window & { __previewLifecycle: { created: string[]; revoked: string[] } }).__previewLifecycle)
  expect(lifecycle.created).toEqual(['blob:fixture-1'])
  expect(lifecycle.revoked).toEqual(['blob:fixture-1'])

  await page.getByTestId('hero-poster-alt-input').fill('')
  await page.getByTestId('hero-poster-url-input').fill('//evil.test')
  await page.getByTestId('hero-poster-save-button').click()
  await expect(page.getByText('Teks alternatif wajib diisi.')).toBeVisible()
  await expect(page.getByText('Gunakan path internal yang diawali / dan bukan //.')).toBeVisible()
})

for (const width of [390, 768, 1024, 1440]) {
  test(`hero poster admin remains overflow-safe at ${width}px`, async ({ page }) => {
    await mockPosterBackend(page, [makePoster('one', true, 10), makePoster('two', false, 20)])
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://localhost:3001/admin/marketing')
    await expect(page.getByTestId('hero-poster-form')).toBeVisible()
    await expect(page.getByTestId('hero-poster-preview')).toBeVisible()
    await expect(page.getByTestId('hero-poster-list')).toBeVisible()
    const overflow = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll<HTMLElement>('body *')]
        .map(element => ({ selector: `${element.tagName.toLowerCase()}.${element.className}`, right: element.getBoundingClientRect().right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
        .filter(item => item.right > window.innerWidth + 1 || item.scrollWidth > item.clientWidth + 1)
        .slice(0, 20),
    }))
    expect(overflow.documentWidth, JSON.stringify(overflow, null, 2)).toBeLessThanOrEqual(overflow.viewport)
  })
}
