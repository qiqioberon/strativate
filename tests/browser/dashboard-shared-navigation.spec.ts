import { expect, test } from '@playwright/test'

const roles = [
  { name: 'admin', url: 'http://localhost:3001/admin', fullName: 'Admin Strativate', email: 'admin@fixture.test', roleLabel: 'Admin' },
  { name: 'mentor', url: 'http://localhost:3001/mentor', fullName: 'Mentor Strativate', email: 'mentor@fixture.test', roleLabel: 'Mentor' },
  { name: 'user', url: 'http://localhost:3001/dashboard', fullName: 'User Strativate', email: 'user@fixture.test', roleLabel: 'User' },
] as const

const emptyAdminCommerceReport = {
  total_revenue: 0,
  total_transactions: 0,
  paid_orders: 0,
  pending_orders: 0,
  customer_count: 0,
  average_order_value: 0,
  total_users: 1,
  total_mentors: 1,
  total_sessions: 0,
  sessions_today: 0,
  pending_sessions: 0,
  trend: [],
  product_distribution: [],
  best_sellers: [],
}

async function stubNotifications(page: import('@playwright/test').Page) {
  const item = {
    id: '98000000-0000-0000-0000-000000000001',
    recipient_user_id: null,
    recipient_role: 'admin',
    type: 'fixture',
    title: 'Template',
    message: 'Template notification fixture',
    related_entity: null,
    related_entity_id: null,
    idempotency_key: 'dashboard-fixture',
    read_at: null,
    created_at: '2026-09-19T00:00:00.000Z',
  }

  await page.route('**/rest/v1/notifications**', async route => {
    if (route.request().method() === 'HEAD') {
      await route.fulfill({ status: 200, headers: { 'Content-Range': '0-0/1' }, body: '' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Content-Range': '0-0/1' },
      body: JSON.stringify([item]),
    })
  })
  await page.route('**/rest/v1/rpc/mark_notification_read', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  await page.route('**/rest/v1/rpc/mark_all_notifications_read', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
}

test.beforeEach(async ({ page }) => {
  await stubNotifications(page)
})

async function stubAdminCommerce(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/rpc/list_admin_commerce_orders', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }))
  await page.route('**/rest/v1/rpc/get_admin_commerce_report', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([emptyAdminCommerceReport]),
  }))
}

function isKnownFixtureAssetFailure(url: string) {
  const parsed = new URL(url)
  if (parsed.pathname.startsWith('/assets/brand/')) return true
  if (parsed.pathname === '/_next/image') return decodeURIComponent(parsed.search).includes('/assets/brand/')
  return false
}

function captureRuntimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  const httpErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400 && !isKnownFixtureAssetFailure(response.url())) {
      httpErrors.push(`${response.status()} ${response.url()}`)
    }
  })
  return { errors, httpErrors }
}

for (const role of roles) {
  test(`${role.name} dashboard shares accessible account and notification popovers`, async ({ page }) => {
    if (role.name === 'admin') await stubAdminCommerce(page)
    const runtime = captureRuntimeErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(role.url)

    const notificationButton = page.getByRole('button', { name: 'Buka notifikasi' })
    const accountButton = page.getByRole('button', { name: 'Buka menu akun' })
    const notificationDialog = page.getByRole('dialog', { name: 'Notifikasi' })
    const accountDialog = page.getByRole('dialog', { name: 'Informasi akun' })

    await notificationButton.click()
    await expect(notificationDialog).toBeVisible()
    await expect(notificationDialog).toContainText('Template')

    await accountButton.click()
    await expect(notificationDialog).toBeHidden()
    await expect(accountDialog).toBeVisible()
    await expect(accountDialog).toContainText(role.fullName)
    await expect(accountDialog).toContainText(role.email)
    await expect(accountDialog).toContainText(role.roleLabel)

    await page.keyboard.press('Escape')
    await expect(accountDialog).toBeHidden()

    await notificationButton.click()
    await expect(notificationDialog).toBeVisible()
    await page.locator('main').click({ position: { x: 24, y: 120 } })
    await expect(notificationDialog).toBeHidden()

    await accountButton.click()
    await accountDialog.getByRole('button', { name: 'Edit Profil' }).click()
    await expect(page.getByRole('heading', { name: 'Profil akun' })).toBeVisible()

    const homeLink = page.getByRole('link', { name: 'Kembali ke Beranda' })
    await expect(homeLink).toBeVisible()
    await expect(homeLink).toHaveAttribute('href', '/')
    await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible()
    expect(runtime.errors).toEqual([])
    expect(runtime.httpErrors).toEqual([])
  })
}

test('user dashboard is owned-content focused and exposes honest digital product empty state', async ({ page }) => {
  const runtime = captureRuntimeErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:3001/dashboard')

  await expect(page.getByText('Jelajahi program', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mentoring saya' })).toBeVisible()
  await page.getByRole('button', { name: 'Produk Digital Saya' }).click()
  await expect(page.getByRole('heading', { name: 'Anda belum memiliki Produk Digital.' })).toBeVisible()

  const storefrontLink = page.getByRole('link', { name: 'Lihat Produk Digital', exact: true })
  await expect(storefrontLink).toHaveAttribute('href', '/produk-digital')
  expect(runtime.errors).toEqual([])
  expect(runtime.httpErrors).toEqual([])
})

test('mentor dashboard uses operational real-data tables and removes the redundant Program tab', async ({ page }) => {
  const runtime = captureRuntimeErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:3001/mentor')

  await expect(page.getByRole('button', { name: 'Program', exact: true })).toHaveCount(0)
  for (const label of ['Ringkasan', 'Kalender', 'Penugasan', 'Peserta Saya', 'Ketersediaan', 'Riwayat Sesi', 'Notifikasi', 'Profil']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible()
  }
  await expect(page.getByText('+12%', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: /^Penugasan/ }).click()
  await expect(page.getByTestId('mentor-assignment-table')).toBeVisible()
  await page.getByPlaceholder('Mentee, email, atau fokus').fill('Bima')
  await expect(page.getByTestId('mentor-assignment-table')).toContainText('Bima Santoso')
  await expect(page.getByTestId('mentor-assignment-table')).not.toContainText('Alya Pratama')
  await page.getByRole('button', { name: /Lihat detail sesi 1 Bima Santoso/ }).click()
  const sessionDialog = page.getByRole('dialog', { name: /Bima Santoso · Sesi 1/ })
  await expect(sessionDialog).toBeVisible()
  await expect(sessionDialog).toContainText('Dibatalkan')
  await page.keyboard.press('Escape')
  await expect(sessionDialog).toBeHidden()

  await page.getByRole('button', { name: 'Peserta Saya' }).click()
  await expect(page.getByTestId('mentor-mentees-table')).toBeVisible()
  await expect(page.getByTestId('mentor-mentees-table')).toContainText('Alya Pratama')

  await page.getByRole('button', { name: 'Riwayat Sesi' }).click()
  await expect(page.getByTestId('mentor-history-table')).toContainText('Selesai')
  await expect(page.getByTestId('mentor-history-table')).toContainText('Dibatalkan')
  expect(runtime.errors).toEqual([])
  expect(runtime.httpErrors).toEqual([])
})

test('mentor assignment table keeps intrinsic Zoom and Detail controls without page overflow', async ({ page }) => {
  for (const size of [{ width: 1536, height: 960 }, { width: 1280, height: 900 }, { width: 820, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    await page.goto('http://localhost:3001/mentor')
    if (size.width <= 800) await page.getByRole('button', { name: 'Buka menu mentor' }).click()
    await page.getByRole('button', { name: /^Penugasan/ }).click()
    const table=page.getByTestId('mentor-assignment-table')
    await expect(table).toBeVisible()
    await expect(table.getByRole('link',{name:'Zoom'})).toBeVisible()
    const detail=table.getByRole('button',{name:/Lihat detail sesi 2 Alya Pratama/})
    await expect(detail).toBeVisible()
    const widths = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
    expect(widths.scrollWidth, `mentor assignments overflow at ${size.width}px`).toBeLessThanOrEqual(widths.innerWidth)
    if(size.width>820){
      const geometry=await table.evaluate(element=>{
        const zoom=element.querySelector<HTMLAnchorElement>('td[data-label="Zoom"] a')!
        const detailButton=element.querySelector<HTMLButtonElement>('td[data-label="Aksi"] button')!
        const zoomRect=zoom.getBoundingClientRect()
        const detailRect=detailButton.getBoundingClientRect()
        return {zoomWidth:zoomRect.width,detailWidth:detailRect.width,zoomWhiteSpace:getComputedStyle(zoom).whiteSpace,detailWhiteSpace:getComputedStyle(detailButton).whiteSpace}
      })
      expect(geometry.zoomWidth).toBeGreaterThan(60)
      expect(geometry.detailWidth).toBeGreaterThan(60)
      expect(geometry.zoomWhiteSpace).toBe('nowrap')
      expect(geometry.detailWhiteSpace).toBe('nowrap')
    }
  }
})

test('all role popovers remain inside the viewport across target responsive widths', async ({ page }) => {
  await stubAdminCommerce(page)
  const sizes = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 900 },
    { width: 375, height: 812 },
  ]

  for (const role of roles) {
    for (const size of sizes) {
      await page.setViewportSize(size)
      await page.goto(role.url)
      await page.getByRole('button', { name: 'Buka notifikasi' }).click()

      const dialog = page.getByRole('dialog', { name: 'Notifikasi' })
      await expect(dialog).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x, `${role.name} ${size.width}x${size.height} popover left edge`).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, `${role.name} ${size.width}x${size.height} popover right edge`).toBeLessThanOrEqual(size.width)
      expect(box!.y, `${role.name} ${size.width}x${size.height} popover top edge`).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height, `${role.name} ${size.width}x${size.height} popover bottom edge`).toBeLessThanOrEqual(size.height)

      const viewport = await page.evaluate(() => {
        const innerWidth = window.innerWidth
        const rects = Array.from(document.querySelectorAll<HTMLElement>('body *')).map(element => {
          const rect = element.getBoundingClientRect()
          const parent = element.parentElement
          return {
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === 'string' ? element.className : '',
            parentClass: parent && typeof parent.className === 'string' ? parent.className : '',
            text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100) || '',
            left: rect.left,
            right: rect.right,
            width: rect.width,
          }
        })
        const rightOverflow = rects
          .filter(rect => rect.right > innerWidth + 0.1)
          .sort((a, b) => b.right - a.right)
          .slice(0, 8)
        const leftOverflow = rects
          .filter(rect => rect.left < -0.1)
          .sort((a, b) => a.left - b.left)
          .slice(0, 3)
        return {
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          innerWidth,
          rightOverflow,
          leftOverflow,
        }
      })
      expect(
        viewport.scrollWidth,
        `${role.name} ${size.width}x${size.height} document overflow: ${viewport.scrollWidth}px > ${viewport.innerWidth}px; body=${viewport.bodyScrollWidth}px; right=${JSON.stringify(viewport.rightOverflow)}; left=${JSON.stringify(viewport.leftOverflow)}`,
      ).toBeLessThanOrEqual(viewport.innerWidth)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
    }
  }
})


test('admin commerce detail stays local while canonical refreshes still synchronize the open order', async ({ page }) => {
  const orderId = '95000000-0000-0000-0000-000000000001'
  let listCalls = 0
  let reportCalls = 0
  let includeOrder = true
  let currentOrder = {
    total_count: 1,
    order_id: orderId,
    user_id: '95000000-0000-0000-0000-000000000002',
    user_email: 'buyer@fixture.test',
    created_at: '2026-09-20T10:00:00.000Z',
    paid_at: null as string | null,
    order_status: 'pending_payment',
    total_amount: 150000,
    item_count: 1,
    item_summary: 'Tryout Nasional',
    items: [{
      id: '95000000-0000-0000-0000-000000000003',
      commerceItemId: '95000000-0000-0000-0000-000000000004',
      kind: 'digital_product',
      name: 'Tryout Nasional',
      quantity: 1,
      unitPrice: 150000,
      subtotal: 150000,
      createdAt: '2026-09-20T10:00:00.000Z',
    }],
    payment: {
      id: '95000000-0000-0000-0000-000000000005',
      provider: 'midtrans',
      providerOrderId: 'fixture-order-1',
      providerTransactionId: null as string | null,
      providerStatus: 'pending' as string | null,
      fraudStatus: null as string | null,
      paymentType: null as string | null,
      grossAmount: 150000,
      status: 'pending_payment',
      createdAt: '2026-09-20T10:00:00.000Z',
      updatedAt: '2026-09-20T10:00:00.000Z',
    },
  }

  await page.route('**/rest/v1/operational_invalidation_versions**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }))
  await page.route('**/rest/v1/rpc/list_admin_commerce_orders', async route => {
    listCalls += 1
    const args = route.request().postDataJSON() as { p_query?: string; p_limit?: number }
    const isDetailLookup = args.p_query === orderId && args.p_limit === 1
    const rows = includeOrder ? [{ ...currentOrder, total_count: 1 }] : []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isDetailLookup ? rows.slice(0, 1) : rows),
    })
  })
  await page.route('**/rest/v1/rpc/get_admin_commerce_report', route => {
    reportCalls += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([emptyAdminCommerceReport]),
    })
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:3001/admin')

  const overviewDetail = page.getByRole('button', { name: `Lihat detail pesanan ${orderId}` })
  await expect(overviewDetail).toBeVisible()
  await page.waitForTimeout(300)
  const overviewBaseline = { listCalls, reportCalls }

  await overviewDetail.click()
  const dialog = page.getByRole('dialog', { name: /#STR-95000000/ })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(300)
  expect({ listCalls, reportCalls }).toEqual(overviewBaseline)

  await dialog.getByRole('button', { name: 'Tutup detail pesanan' }).click()
  await expect(dialog).toBeHidden()
  await page.waitForTimeout(300)
  expect({ listCalls, reportCalls }).toEqual(overviewBaseline)

  await page.getByRole('button', { name: 'Pesanan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pesanan', exact: true, level: 2 })).toBeVisible()
  const orderDetail = page.getByRole('button', { name: `Lihat detail pesanan ${orderId}` })
  await expect(orderDetail).toBeVisible()
  await page.waitForTimeout(300)
  const ordersBaseline = { listCalls, reportCalls }

  await orderDetail.click()
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(300)
  expect({ listCalls, reportCalls }).toEqual(ordersBaseline)

  currentOrder = {
    ...currentOrder,
    order_status: 'paid',
    paid_at: '2026-09-21T06:00:00.000Z',
    payment: {
      ...currentOrder.payment,
      providerStatus: 'settlement',
      status: 'paid',
      updatedAt: '2026-09-21T06:00:00.000Z',
    },
  }

  const beforeRefresh = { listCalls, reportCalls }
  await page.getByRole('button', { name: 'Muat ulang' }).evaluate(element => (element as HTMLButtonElement).click())
  await expect.poll(() => reportCalls).toBe(beforeRefresh.reportCalls + 1)
  await expect.poll(() => listCalls).toBe(beforeRefresh.listCalls + 1)
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Lunas')

  includeOrder = false
  const beforeMissingRefresh = { listCalls, reportCalls }
  await page.getByRole('button', { name: 'Muat ulang' }).evaluate(element => (element as HTMLButtonElement).click())
  await expect.poll(() => reportCalls).toBe(beforeMissingRefresh.reportCalls + 1)
  await expect.poll(() => listCalls).toBe(beforeMissingRefresh.listCalls + 2)
  await expect(dialog).toBeHidden()

  const beforeQuery = { listCalls, reportCalls }
  await page.getByPlaceholder('Order, email, atau produk').fill('tidak-ada')
  await expect.poll(() => reportCalls).toBe(beforeQuery.reportCalls + 1)
  await expect.poll(() => listCalls).toBe(beforeQuery.listCalls + 1)

  const stableCounts = { listCalls, reportCalls }
  await page.waitForTimeout(500)
  expect({ listCalls, reportCalls }).toEqual(stableCounts)
})
