import { expect, test, type Locator, type Page } from '@playwright/test'

const sessionId = '93000000-0000-0000-0000-000000000001'
const mentorId = '93000000-0000-0000-0000-000000000002'

function eventTimes() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 16, 8, 0, 0))
  const end = new Date(start.getTime() + 75 * 60_000)
  const personalStart = new Date(start.getTime() + 3 * 60 * 60_000)
  const personalEnd = new Date(personalStart.getTime() + 60 * 60_000)
  return { start, end, personalStart, personalEnd }
}

function calendarPayload(role: 'admin' | 'mentor' | 'mentee', connected = false) {
  const { start, end, personalStart, personalEnd } = eventTimes()
  const events = [
    {
      id: sessionId,
      source: 'strativate',
      title: 'Strativate Private Mentoring — Business Analysis & Case Structuring',
      start: start.toISOString(),
      end: end.toISOString(),
      sessionId,
      sessionNumber: 2,
      purchasedSessions: 3,
      focusName: 'Business Analysis & Case Structuring',
      status: 'scheduled',
      mentorName: 'Muhammad Aqil',
      mentorTierName: 'Top Student',
      menteeName: 'Yuta tes',
      menteeEmail: 'yuta@example.test',
      timezone: 'Asia/Jakarta',
      durationMinutes: 75,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      providerMeetingUrl: 'https://meet.google.com/abc-defg-hij',
      manualMeetingUrl: null,
      googleSyncStatus: 'synced',
      googleSyncError: null,
    },
    ...(connected ? [{
      id: 'google-personal-1',
      source: 'google',
      title: role === 'mentor' ? 'Agenda pribadi mentor' : 'Agenda pribadi saya',
      start: personalStart.toISOString(),
      end: personalEnd.toISOString(),
      htmlLink: 'https://calendar.google.com/calendar/event?eid=fixture',
    }] : []),
  ]
  return {
    events,
    connection: {
      connected,
      accountEmail: connected ? `${role}@gmail.com` : null,
      status: connected ? 'connected' : 'not_connected',
      scopes: [],
      lastError: null,
    },
    googleError: null,
  }
}

async function stubAdminCommerce(page: Page) {
  await page.route('**/rest/v1/rpc/list_admin_commerce_orders', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }))
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

async function stubCalendar(page: Page, role: 'admin' | 'mentor' | 'mentee', connected = false) {
  await page.route('**/api/calendar/events**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(calendarPayload(role, connected)),
  }))
}

async function openAdminCalendar(page: Page, width: number) {
  await page.goto('http://localhost:3001/admin')
  if (width <= 800) await page.getByRole('button', { name: 'Buka menu admin' }).click()
  await page.getByRole('button', { name: 'Jadwal', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Jadwal Mentoring' })).toBeVisible()
  await expect(page.locator('.calendar-loading')).toBeHidden()
}

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(dimensions.documentWidth, `document width ${dimensions.documentWidth}, viewport ${dimensions.innerWidth}`).toBeLessThanOrEqual(dimensions.innerWidth)
  expect(dimensions.bodyWidth, `body width ${dimensions.bodyWidth}, viewport ${dimensions.innerWidth}`).toBeLessThanOrEqual(dimensions.innerWidth)
}

async function expectToolbarDoesNotOverlap(page: Page) {
  const nav = await page.locator('.calendar-nav').boundingBox()
  const views = await page.locator('.calendar-view-switch').boundingBox()
  expect(nav).not.toBeNull()
  expect(views).not.toBeNull()
  const separated = nav!.x + nav!.width <= views!.x + 0.5
    || views!.x + views!.width <= nav!.x + 0.5
    || nav!.y + nav!.height <= views!.y + 0.5
    || views!.y + views!.height <= nav!.y + 0.5
  expect(separated, `calendar toolbar controls overlap: nav=${JSON.stringify(nav)} views=${JSON.stringify(views)}`).toBe(true)
}

async function expectDialogInViewport(page: Page, dialog: Locator) {
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 0.5)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 0.5)
}

test('admin calendar stays contained and event detail stays inside desktop, tablet, and mobile viewports', async ({ page }) => {
  await stubAdminCommerce(page)
  await stubCalendar(page, 'admin')

  for (const size of [
    { width: 1440, height: 900 },
    { width: 768, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(size)
    await openAdminCalendar(page, size.width)
    await expectToolbarDoesNotOverlap(page)
    await expectNoDocumentOverflow(page)

    const event = page.locator('.calendar-event.strativate').first()
    await expect(event).toBeVisible()
    await event.click()

    const detail = page.locator('dialog.calendar-dialog:not(.schedule-dialog)')
    await expect(detail).toBeVisible()
    await expect(detail).toContainText('Business Analysis & Case Structuring')
    await expect(detail).toContainText('75 menit')
    await expect(detail).toContainText('Asia/Jakarta')
    await expectDialogInViewport(page, detail)
    await detail.getByRole('button', { name: 'Tutup detail' }).click()
    await expect(detail).toBeHidden()
  }
})

test('admin reschedules from an actual slot without a manual datetime field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await stubAdminCommerce(page)
  await stubCalendar(page, 'admin')

  const { start } = eventTimes()
  const slotStart = new Date(start.getTime() + 6 * 24 * 60 * 60_000)
  const slotEnd = new Date(slotStart.getTime() + 75 * 60_000)
  await page.route(`**/api/admin/private-mentoring/sessions/${sessionId}/slots`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      context: { sessionId, focusName: 'Business Analysis & Case Structuring', durationMinutes: 75, sessionNumber: 2, purchasedSessions: 3 },
      slots: [{ mentorId, mentorName: 'Muhammad Aqil', timezone: 'Asia/Jakarta', start: slotStart.toISOString(), end: slotEnd.toISOString(), menteeConflict: false }],
      mentorWarnings: [],
      message: '',
    }),
  }))

  let scheduledBody: { mentorId?: string; start?: string } | null = null
  await page.route(`**/api/admin/private-mentoring/sessions/${sessionId}/schedule`, async route => {
    scheduledBody = route.request().postDataJSON() as { mentorId?: string; start?: string }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sync: { status: 'synced' } }) })
  })

  await openAdminCalendar(page, 1440)
  await page.locator('.calendar-event.strativate').first().click()
  await page.getByRole('button', { name: 'Reschedule' }).click()

  const schedule = page.getByRole('dialog', { name: 'Jadwalkan Private Mentoring' })
  await expect(schedule).toBeVisible()
  await expect(schedule.locator('input[type="datetime-local"]')).toHaveCount(0)
  await expect(schedule.locator('.schedule-slots button')).toHaveCount(1)
  await schedule.locator('.schedule-slots button').click()
  await schedule.getByRole('button', { name: 'Konfirmasi slot' }).click()
  await expect.poll(() => scheduledBody?.mentorId).toBe(mentorId)
  expect(scheduledBody).toEqual({ mentorId, start: slotStart.toISOString() })
})

test('mentee calendar keeps Strativate schedule read-only with Meet and WhatsApp actions', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await stubCalendar(page, 'mentee')
  await page.goto('http://localhost:3001/dashboard')
  await page.getByRole('button', { name: 'Buka navigasi' }).click()
  await page.getByRole('button', { name: 'Jadwal', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Jadwal', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect Google Calendar' })).toBeVisible()
  await page.locator('.calendar-event.strativate').first().click()

  const detail = page.locator('dialog.calendar-dialog:not(.schedule-dialog)')
  await expect(detail.getByRole('link', { name: 'Join Google Meet' })).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij')
  await expect(detail.getByRole('link', { name: 'Hubungi Admin via WhatsApp' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Reschedule' })).toHaveCount(0)
  await expectDialogInViewport(page, detail)
  await expectNoDocumentOverflow(page)
})

test('mentor calendar combines connected Google events with assigned Strativate sessions and links to availability', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await stubCalendar(page, 'mentor', true)
  await page.goto('http://localhost:3001/mentor')
  await page.getByRole('button', { name: 'Buka menu mentor' }).click()
  await page.getByRole('button', { name: 'Kalender', exact: true }).click()

  await expect(page.getByText('Connected as mentor@gmail.com')).toBeVisible()
  await expect(page.locator('.calendar-event.google')).toHaveCount(1)
  await page.locator('.calendar-event.strativate').first().click()

  const detail = page.locator('dialog.calendar-dialog:not(.schedule-dialog)')
  await expect(detail.getByRole('link', { name: 'Join Google Meet' })).toBeVisible()
  await expect(detail.getByRole('link', { name: 'Hubungi Admin via WhatsApp' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Atur availability' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Reschedule' })).toHaveCount(0)
  await expectDialogInViewport(page, detail)
  await expectNoDocumentOverflow(page)

  await detail.getByRole('button', { name: 'Atur availability' }).click()
  await expect(page.getByRole('heading', { name: 'Buka waktu terbaik Anda untuk sesi.' })).toBeVisible()
})
