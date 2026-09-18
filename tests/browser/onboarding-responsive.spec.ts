import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'

const onboardingUserId = '95000000-0000-0000-0000-000000000004'
const requiredViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

function fixtureJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: onboardingUserId, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })).toString('base64url')
  return header + '.' + payload + '.fixture'
}

async function authenticateOnboardingFixture(context: BrowserContext) {
  const accessToken = fixtureJwt()
  const session = JSON.stringify({
    access_token: accessToken,
    refresh_token: 'fixture-refresh-token',
    token_type: 'bearer',
    expires_at: 4102444800,
    expires_in: 3600,
    user: { id: onboardingUserId, role: 'authenticated', aud: 'authenticated', email: 'onboarding@example.test' },
  })
  await context.addCookies([{
    name: 'sb-127-auth-token',
    value: 'base64-' + Buffer.from(session).toString('base64url'),
    url: process.env.TEST_BASE_URL || 'http://localhost:3000',
    sameSite: 'Lax',
  }])
}

async function resetOnboardingFixture(page: Page) {
  const response = await page.request.post('http://127.0.0.1:54321/__fixture/onboarding-reset')
  expect(response.ok()).toBe(true)
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function expectHorizontallyInsideViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
}

test('anonymous onboarding guard remains safe at every required viewport', async ({ page }) => {
  for (const viewport of requiredViewports) {
    await page.setViewportSize(viewport)
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/auth$/)
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test.describe.serial('deterministic authenticated onboarding', () => {
  test.beforeEach(async ({ context, page }) => {
    await resetOnboardingFixture(page)
    await authenticateOnboardingFixture(context)
  })

  test('server error prevents progression and duplicate clicks produce one canonical save attempt', async ({ page }) => {
    await page.goto('/onboarding')
    await page.getByRole('button', { name: 'Mulai', exact: true }).click()
    await page.getByLabel('Nama depan').fill('Yuta')
    await page.getByLabel('Nama belakang').fill('Prajahita')
    await page.getByLabel('Nama pengguna').fill('yuta_fixture')

    const failure = await page.request.post('http://127.0.0.1:54321/__fixture/onboarding-fail-next-save')
    expect(failure.ok()).toBe(true)

    const continueButton = page.getByRole('button', { name: /Lanjutkan/ })
    await continueButton.dblclick()
    await expect(page.getByRole('alert')).toContainText('Langkah belum tersimpan')
    await expect(page.getByRole('heading', { name: 'Kita mulai dari dirimu dulu.' })).toBeVisible()

    const state = await (await page.request.get('http://127.0.0.1:54321/__fixture/onboarding-state')).json()
    expect(state.saveCalls).toBe(1)
    expect(state.mentee.onboarding_step).toBe(1)
  })

  test('complete guided flow preserves values, stays layout-safe and keeps Calendar optional', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/onboarding')

    await expect(page.getByRole('heading', { name: /Selamat datang di Strativate, Yuta/ })).toBeVisible()
    await page.getByRole('button', { name: 'Mulai', exact: true }).click()

    await page.getByLabel('Nama depan').fill('Yuta')
    await page.getByLabel('Nama belakang').fill('Prajahita')
    await page.getByLabel('Nama pengguna').fill('yuta_fixture')
    await page.getByRole('button', { name: /Lanjutkan/ }).click()

    await expect(page.getByRole('heading', { name: 'Saat ini kamu belajar di mana?' })).toBeVisible()
    await page.getByLabel('Institusi').fill('Institut Teknologi')
    const option = page.getByRole('option', { name: /Institut Teknologi Sepuluh Nopember/ })
    await expect(option).toBeVisible()
    await option.click()
    await page.getByRole('button', { name: /Lanjutkan/ }).click()

    await page.getByLabel('Jurusan / fakultas').fill('Teknik Informatika')
    await page.getByRole('button', { name: /Kembali/ }).click()
    await expect(page.getByLabel('Institusi')).toHaveValue('Institut Teknologi Sepuluh Nopember')
    await page.getByRole('button', { name: /Lanjutkan/ }).click()
    await expect(page.getByLabel('Jurusan / fakultas')).toHaveValue('Teknik Informatika')
    await page.getByRole('button', { name: /Lanjutkan/ }).click()

    await page.getByLabel('Tahun angkatan').fill('2022')
    await page.getByRole('button', { name: /Simpan & lanjutkan/ }).click()

    await expect(page.getByRole('heading', { name: 'Kamu menemukan Strativate dari mana?' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Kamu menemukan Strativate dari mana?' })).toBeVisible()
    await expect(page.getByText('Langkah 3 dari 4', { exact: true })).toBeVisible()
    await page.getByText('Lainnya', { exact: true }).click()
    await page.getByLabel('Sumber informasi lainnya').fill('Komunitas kampus')
    await page.getByRole('button', { name: /Simpan & lanjutkan/ }).click()

    await expect(page.getByRole('heading', { name: 'Bidang kompetisi apa yang paling menarik buatmu?' })).toBeVisible()
    await page.getByText('Business Case', { exact: true }).click()
    await page.getByText('UI/UX', { exact: true }).click()

    for (const viewport of requiredViewports) {
      await page.setViewportSize(viewport)
      await expectNoHorizontalOverflow(page)
      await expectHorizontallyInsideViewport(page, page.locator('.onboarding-heading h1'))
      await expectHorizontallyInsideViewport(page, page.locator('.onboarding-progress'))
      await expectHorizontallyInsideViewport(page, page.locator('.onboarding-actions__primary'))
    }

    await page.setViewportSize({ width: 320, height: 568 })
    await expectNoHorizontalOverflow(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.locator('.onboarding-stage')).toHaveCSS('animation-name', 'none')
    await page.getByRole('button', { name: 'Selesaikan data utama' }).click()

    await expect(page).toHaveURL(/\/onboarding\/calendar$/)
    await expect(page.getByRole('heading', { name: /Semua sudah siap, Yuta/ })).toBeVisible()
    await expect(page.getByText('Institut Teknologi Sepuluh Nopember', { exact: true })).toBeVisible()
    await expect(page.getByText(/Business Case, UI\/UX/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Hubungkan Google Calendar' })).toBeVisible()
    await page.getByRole('link', { name: 'Lewati sekarang' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const state = await (await page.request.get('http://127.0.0.1:54321/__fixture/onboarding-state')).json()
    expect(state.saveCalls).toBe(4)
    expect(state.mentee.onboarding_step).toBe(4)
    expect(state.mentee.onboarding_completed_at).not.toBeNull()
    expect(state.interestIds).toHaveLength(2)
  })
})
