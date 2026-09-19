import { expect, test, type Page } from '@playwright/test'

const sessionId = '94000000-0000-0000-0000-000000000001'

function calendarPayload(role: 'admin' | 'mentor' | 'mentee') {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 16, 8, 0, 0))
  const end = new Date(start.getTime() + 75 * 60_000)
  return {
    events: [{
      id: sessionId,
      source: 'strativate',
      title: 'Strativate Private Mentoring — Business Analysis & Case Structuring',
      start: start.toISOString(),
      end: end.toISOString(),
      sessionId,
      sessionNumber: 1,
      purchasedSessions: 3,
      focusName: 'Business Analysis & Case Structuring',
      status: 'scheduled',
      mentorName: 'Muhammad Aqil',
      mentorTierName: 'Top Student',
      menteeName: 'Yuta tes',
      menteeEmail: 'yuta@example.test',
      timezone: 'Asia/Jakarta',
      durationMinutes: 75,
      meetingUrl: 'https://zoom.us/j/987654321',
      providerMeetingUrl: 'https://zoom.us/j/987654321',
      manualMeetingUrl: null,
      googleSyncStatus: 'synced',
      googleSyncError: null,
    }],
    connection: {
      connected: false,
      accountEmail: null,
      status: 'not_connected',
      scopes: [],
      lastError: null,
    },
    googleError: 'Google Calendar API has not been used in project 123 before or it is disabled. (status 403)',
    role,
  }
}

async function stubCalendar(page: Page, role: 'admin' | 'mentor' | 'mentee') {
  await page.route('**/api/calendar/events**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(calendarPayload(role)),
  }))
}

async function stubAdminCommerce(page: Page) {
  await page.route('**/rest/v1/rpc/list_admin_commerce_orders', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/rpc/get_admin_commerce_report', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      total_revenue: 0,
      total_transactions: 0,
      paid_orders: 0,
      pending_orders: 0,
      customer_count: 0,
      average_order_value: 0,
      total_users: 1,
      total_mentors: 1,
      total_sessions: 1,
      sessions_today: 0,
      pending_sessions: 0,
      trend: [],
      product_distribution: [],
      best_sellers: [],
    }]),
  }))
}

async function expectMobileCalendarPolish(page: Page) {
  await expect(page.locator('.calendar-loading')).toBeHidden()
  const card = page.locator('.calendar-card')
  const nav = page.locator('.calendar-nav')
  const switcher = page.locator('.calendar-view-switch')
  const source = page.locator('.calendar-source-controls')
  await expect(card).toBeVisible()
  await expect(nav).toBeVisible()
  await expect(switcher).toBeVisible()
  await expect(source).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hari ini' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sebelumnya' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Berikutnya' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bulan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Minggu' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agenda' })).toBeVisible()

  const boxes = await Promise.all([card, nav, switcher, source].map(locator => locator.boundingBox()))
  const [cardBox, navBox, switchBox, sourceBox] = boxes
  expect(cardBox).not.toBeNull()
  for (const box of [navBox, switchBox, sourceBox]) {
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(cardBox!.x - 0.5)
    expect(box!.x + box!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 0.5)
  }
  expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(switchBox!.y + 0.5)

  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport)
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport)
}

async function expectNoDeveloperDiagnostics(page: Page) {
  await expect(page.getByText(/403 access_denied/)).toHaveCount(0)
  await expect(page.getByText(/Audience.*Test users/)).toHaveCount(0)
  await expect(page.getByText(/Google Calendar API has not been used/)).toHaveCount(0)
}

test('admin, mentor, and mentee calendars keep mobile controls contained without developer diagnostics', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })

  await stubAdminCommerce(page)
  await stubCalendar(page, 'admin')
  await page.goto('http://localhost:3001/admin')
  await page.getByRole('button', { name: 'Buka menu admin' }).click()
  await page.getByRole('button', { name: 'Jadwal', exact: true }).click()
  await expectMobileCalendarPolish(page)
  await expectNoDeveloperDiagnostics(page)

  await stubCalendar(page, 'mentor')
  await page.goto('http://localhost:3001/mentor')
  await page.getByRole('button', { name: 'Buka menu mentor' }).click()
  await page.getByRole('button', { name: 'Kalender', exact: true }).click()
  await expectMobileCalendarPolish(page)
  await expectNoDeveloperDiagnostics(page)

  await stubCalendar(page, 'mentee')
  await page.goto('http://localhost:3001/dashboard')
  await page.getByRole('button', { name: 'Buka navigasi' }).click()
  await page.getByRole('button', { name: 'Jadwal', exact: true }).click()
  await expectMobileCalendarPolish(page)
  await expectNoDeveloperDiagnostics(page)
})
