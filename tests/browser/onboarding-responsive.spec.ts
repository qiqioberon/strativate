import { mkdirSync } from 'node:fs'
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

async function setOnboardingMode(page: Page, registrationMethod: 'email' | 'google', passwordSet: boolean) {
  const response = await page.request.post('http://127.0.0.1:54321/__fixture/onboarding-mode', {
    data: { registration_method: registrationMethod, password_set_at: passwordSet ? 'set' : null },
  })
  expect(response.ok()).toBe(true)
}

async function setCalendarConnected(page: Page, connected: boolean) {
  const response = await page.request.post('http://127.0.0.1:54321/__fixture/onboarding-calendar', {
    data: {
      connected,
      account_email: 'yuta.onboarding.fixture.with.a.very.long.address@example.test',
    },
  })
  expect(response.ok()).toBe(true)
}

async function ambientMotionState(page: Page, selector = '.onboarding-ambient__glow--orange > span') {
  return page.locator(selector).evaluate(element => {
    const animation = element.getAnimations()[0]
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return {
      animationName: getComputedStyle(element).animationName,
      currentTime: typeof animation?.currentTime === 'number' ? animation.currentTime : 0,
      x: matrix.e,
      y: matrix.f,
      scaleX: matrix.a,
    }
  })
}

async function expectAmbientMoved(page: Page, selector?: string) {
  const before = await ambientMotionState(page, selector)
  await page.waitForTimeout(1400)
  const after = await ambientMotionState(page, selector)
  const displacement = Math.hypot(after.x - before.x, after.y - before.y)
  expect(after.animationName).not.toBe('none')
  expect(after.currentTime).toBeGreaterThan(before.currentTime)
  expect(displacement + Math.abs(after.scaleX - before.scaleX) * 100).toBeGreaterThan(0.35)
}

async function fixtureState(page: Page) {
  return await (await page.request.get('http://127.0.0.1:54321/__fixture/onboarding-state')).json()
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function waitForBrandIntro(page: Page) {
  const intro = page.getByTestId('initial-brand-intro')
  if (await intro.count()) await expect(intro).toBeHidden({ timeout: 6000 })
}

async function settleVisualCapture(page: Page) {
  await page.waitForTimeout(360)
}

async function expectHorizontallyInsideViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
}

async function waitForOnboardingIdle(page: Page) {
  const routeStage = page.locator('.onboarding-route-stage')
  if (await routeStage.count()) await expect(routeStage).toHaveAttribute('data-route-phase', 'idle')
  const experience = page.locator('.onboarding-experience')
  if (await experience.count()) await expect(experience).toHaveAttribute('data-phase', 'idle')
}

async function goToUsername(page: Page) {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: /Selamat datang di Strativate, Yuta/ })).toBeVisible()
  await page.getByRole('button', { name: 'Mulai', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Kami mengenalmu sebagai/ })).toBeVisible()
  await expect(page.getByText('Yuta Fixture', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Nama pengguna', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Institusi')).toHaveCount(0)
  await page.getByRole('button', { name: /Ya, lanjutkan/ }).click()
  await expect(page.getByRole('heading', { name: 'Mau dipanggil apa di Strativate?' })).toBeVisible()
  await waitForOnboardingIdle(page)
}

async function goToPassword(page: Page) {
  await goToUsername(page)
  await page.getByLabel('Nama pengguna', { exact: true }).fill('yuta_fixture')
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Institusi')).toHaveCount(0)
  await page.getByRole('button', { name: 'Lanjutkan dari nama pengguna' }).click()
  await expect(page.getByRole('heading', { name: /Kata sandi akunmu sudah siap|Sekarang, amankan akunmu|Akun Google-mu sudah siap/ })).toBeVisible()
  await waitForOnboardingIdle(page)
  await expect(page.getByLabel('Nama pengguna', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Institusi')).toHaveCount(0)
}

async function completeIdentity(page: Page) {
  await goToPassword(page)
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saat ini kamu belajar di mana?' })).toBeVisible()
  await waitForOnboardingIdle(page)
}

async function completeInstitution(page: Page, exerciseBack = false) {
  await page.getByLabel('Institusi').fill('Institut Teknologi')
  const option = page.getByRole('option', { name: /Institut Teknologi Sepuluh Nopember/ })
  await expect(option).toBeVisible()

  const longOption = page.getByRole('option', { name: /Universitas Pembangunan Nasional Veteran Jawa Timur/ })
  await expect(longOption).toBeVisible()
  await expectHorizontallyInsideViewport(page, longOption)

  await option.click()
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Kamu mengambil jurusan atau fakultas apa?' })).toBeVisible()
  await waitForOnboardingIdle(page)
  await expect(page.getByText('Institut Teknologi Sepuluh Nopember', { exact: true })).toBeVisible()

  await page.getByLabel('Jurusan / fakultas').fill('Teknik Informatika dan Rekayasa Perangkat Lunak untuk Sistem Berskala Besar')
  await expect(page.getByLabel('Jurusan / fakultas')).toHaveValue('Teknik Informatika dan Rekayasa Perangkat Lunak untuk Sistem Berskala Besar')
  if (exerciseBack) {
    await page.getByRole('button', { name: /Kembali/ }).click()
    await expect(page.getByLabel('Institusi')).toHaveValue('Institut Teknologi Sepuluh Nopember')
    await waitForOnboardingIdle(page)
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Kamu mengambil jurusan atau fakultas apa?' })).toBeVisible()
    await waitForOnboardingIdle(page)
    await expect(page.getByLabel('Jurusan / fakultas')).toHaveValue('Teknik Informatika dan Rekayasa Perangkat Lunak untuk Sistem Berskala Besar')
  }

  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Kamu mulai di sana tahun berapa?' })).toBeVisible()
  await waitForOnboardingIdle(page)
  await page.getByRole('spinbutton', { name: 'Tahun angkatan' }).fill('2022')
  await page.getByRole('button', { name: /Simpan & lanjutkan/ }).click()
  await expect(page.getByRole('heading', { name: /Kamu pertama kali menemukan/ })).toBeVisible()
  await waitForOnboardingIdle(page)
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

test.describe.serial('immersive deterministic onboarding', () => {
  test.beforeEach(async ({ context, page }) => {
    await resetOnboardingFixture(page)
    await authenticateOnboardingFixture(context)
  })

  test('ambient background moves autonomously and micro-stage modulation does not remount it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/onboarding')
    await expect(page.getByRole('heading', { name: /Selamat datang di Strativate, Yuta/ })).toBeVisible()

    const ambient = page.getByTestId('onboarding-ambient')
    await expect(ambient).toHaveCount(1)
    await ambient.evaluate(element => element.setAttribute('data-persistence-probe', 'alive'))
    await expectAmbientMoved(page)

    const animationBefore = await ambientMotionState(page)

    await page.getByRole('button', { name: 'Mulai', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Kami mengenalmu sebagai/ })).toBeVisible()

    await expect(ambient).toHaveAttribute('data-persistence-probe', 'alive')
    const animationAfter = await ambientMotionState(page)
    expect(animationAfter.currentTime).toBeGreaterThan(animationBefore.currentTime)
  })

  test('mobile autonomous ambience remains active at 320 and 390 without causing overflow', async ({ page }) => {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.goto('/onboarding')
      await expect(page.getByRole('heading', { name: /Selamat datang di Strativate, Yuta/ })).toBeVisible()
      await expectAmbientMoved(page, '.onboarding-ambient__ring--one > span')
      await expectNoHorizontalOverflow(page)
    }
  })

  test('name edit username and password are separate questions and a failed save never advances', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/onboarding')
    await page.getByRole('button', { name: 'Mulai', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Kami mengenalmu sebagai/ })).toBeVisible()
    await page.getByRole('button', { name: 'Ubah nama', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Siapa namamu?' })).toBeVisible()
    await expect(page.getByLabel('Nama depan')).toBeVisible()
    await expect(page.getByLabel('Nama belakang')).toBeVisible()
    await expect(page.getByLabel('Nama pengguna', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveCount(0)

    await page.getByLabel('Nama depan').fill('Yuta')
    await page.getByLabel('Nama belakang').fill('Prajahita')
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Mau dipanggil apa di Strativate?' })).toBeVisible()
    await waitForOnboardingIdle(page)
    await expect(page.getByLabel('Nama depan')).toHaveCount(0)
    await page.getByLabel('Nama pengguna', { exact: true }).fill('yuta_fixture')
    await page.getByRole('button', { name: 'Lanjutkan dari nama pengguna' }).click()

    await expect(page.getByRole('heading', { name: 'Kata sandi akunmu sudah siap.' })).toBeVisible()
    await waitForOnboardingIdle(page)
    await expect(page.getByLabel('Nama pengguna', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Ubah kata sandi', exact: true }).click()
    await expect(page.getByLabel('Kata sandi baru', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Konfirmasi kata sandi', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Batal ubah kata sandi', exact: true }).click()

    const failure = await page.request.post('http://127.0.0.1:54321/__fixture/onboarding-fail-next-save')
    expect(failure.ok()).toBe(true)

    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).dblclick()
    await expect(page.locator('.onboarding-error')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kata sandi akunmu sudah siap.' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectHorizontallyInsideViewport(page, page.locator('.onboarding-error'))

    const state = await fixtureState(page)
    expect(state.saveCalls).toBe(1)
    expect(state.mentee.onboarding_step).toBe(1)
  })

  test('Google password setup is visibly optional and reduced-motion flow remains functional', async ({ page }) => {
    await setOnboardingMode(page, 'google', false)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await goToPassword(page)

    await expect(page.locator('.onboarding-ambient__glow--orange > span')).toHaveCSS('animation-name', 'none')
    await expect(page.getByRole('heading', { name: 'Akun Google-mu sudah siap.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tambahkan kata sandi', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lewati', exact: true })).toBeVisible()
    await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Lewati', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Saat ini kamu belajar di mana?' })).toBeVisible()

    const state = await fixtureState(page)
    expect(state.saveCalls).toBe(1)
    expect(state.mentee.onboarding_step).toBe(2)
  })

  test('missing institution query is a discoverable secondary action on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await completeIdentity(page)

    await page.getByLabel('Institusi').fill('Univ Tidak Ada')
    const action = page.getByRole('button', { name: /Ajukan “Univ Tidak Ada”/ })
    await expect(action).toBeVisible()
    await expectHorizontallyInsideViewport(page, action)
    await expectNoHorizontalOverflow(page)
    await action.click()
    await expect(page.getByText('Institut Teknologi Sepuluh Nopember', { exact: true })).toBeVisible()
  })

  test('normal referral is one direct save and auto-advances without a redundant Continue button', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 })
    await completeIdentity(page)
    await completeInstitution(page)

    await expect(page.getByRole('button', { name: /Lanjutkan|Simpan & lanjutkan/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Instagram', exact: true }).dblclick()
    await expect(page.getByRole('heading', { name: 'Apa yang paling ingin kamu eksplor di Strativate?' })).toBeVisible()

    const state = await fixtureState(page)
    expect(state.saveCalls).toBe(3)
    expect(state.mentee.onboarding_step).toBe(4)
  })

  test('referral Other reveals one focused custom response before saving', async ({ page }) => {
    await completeIdentity(page)
    await completeInstitution(page)

    await page.getByRole('button', { name: 'Lainnya', exact: true }).click()
    await expect(page.getByText('Ceritakan dari mana kamu mengenal Strativate.', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Apa yang paling ingin kamu eksplor di Strativate?' })).toHaveCount(0)

    await page.getByLabel('Ceritakan dari mana kamu mengenal Strativate.').fill('Komunitas kampus dan organisasi mahasiswa')
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Apa yang paling ingin kamu eksplor di Strativate?' })).toBeVisible()
  })

  test('full flow preserves local micro-stage values, resumes canonically, handles long dynamic data, and keeps Calendar optional', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/onboarding')
    await waitForBrandIntro(page)
    await expect(page.getByRole('heading', { name: /Selamat datang di Strativate, Yuta/ })).toBeVisible()
    await settleVisualCapture(page)
    mkdirSync('test-results/onboarding-screenshots', { recursive: true })
    await page.screenshot({ path: 'test-results/onboarding-screenshots/welcome-mobile-390x844.png', fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await settleVisualCapture(page)
    await page.screenshot({ path: 'test-results/onboarding-screenshots/welcome-desktop-1440x900.png', fullPage: true })

    await page.setViewportSize({ width: 390, height: 844 })
    await completeIdentity(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await settleVisualCapture(page)
    await page.screenshot({ path: 'test-results/onboarding-screenshots/institution-desktop-1440x900.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await completeInstitution(page, true)
    await page.setViewportSize({ width: 1440, height: 900 })
    await settleVisualCapture(page)
    await page.screenshot({ path: 'test-results/onboarding-screenshots/referral-desktop-1440x900.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })

    await page.reload()
    await expect(page.getByRole('heading', { name: /Kamu pertama kali menemukan/ })).toBeVisible()
    await expect(page.getByText(/Langkah [1-4] dari 4/)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Selamat datang/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'Instagram', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Apa yang paling ingin kamu eksplor di Strativate?' })).toBeVisible()

    const interestCards = page.locator('.onboarding-answer-card--check')
    expect(await interestCards.count()).toBeGreaterThanOrEqual(12)
    const businessCard = interestCards.filter({ hasText: 'Kasus Bisnis' })
    const uiuxCard = interestCards.filter({ hasText: 'UI/UX' })
    await businessCard.click()
    await expect(businessCard.getByRole('checkbox')).toBeChecked()
    await uiuxCard.click()
    await expect(uiuxCard.getByRole('checkbox')).toBeChecked()
    await expect(page.getByRole('button', { name: /Lanjutkan dengan 2 pilihan/ })).toBeVisible()

    const longInterest = page.getByText('Strategi Transformasi Digital dan Inovasi Bisnis Berkelanjutan untuk Organisasi', { exact: true })
    await expect(longInterest).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await settleVisualCapture(page)
    await page.screenshot({ path: 'test-results/onboarding-screenshots/interests-mobile-390x844.png', fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: 'test-results/onboarding-screenshots/interests-desktop-1440x900.png', fullPage: true })

    for (const viewport of requiredViewports) {
      await page.setViewportSize(viewport)
      await expectNoHorizontalOverflow(page)
      await expectHorizontallyInsideViewport(page, page.getByRole('heading', { name: 'Apa yang paling ingin kamu eksplor di Strativate?' }))
      await expectHorizontallyInsideViewport(page, page.locator('.onboarding-progress-minimal'))
      await expectHorizontallyInsideViewport(page, interestCards.first())
      await expectHorizontallyInsideViewport(page, longInterest)
      const labelBox = await longInterest.boundingBox()
      expect(labelBox).not.toBeNull()
      expect(labelBox!.width).toBeGreaterThan(100)
      expect(await longInterest.evaluate(element => getComputedStyle(element).wordBreak)).toBe('normal')
      await expectHorizontallyInsideViewport(page, page.getByRole('button', { name: /Lanjutkan dengan 2 pilihan/ }))
    }

    const ambient = page.getByTestId('onboarding-ambient')
    await ambient.evaluate(element => element.setAttribute('data-route-probe', 'persistent'))

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: /Lanjutkan dengan 2 pilihan/ }).click()
    await expect(page.getByText('Sip, pilihanmu sudah tersimpan.', { exact: true })).toBeVisible({ timeout: 1000 })

    await expect(page).toHaveURL(/\/onboarding\/calendar$/)
    await expect(page.getByTestId('onboarding-ambient')).toHaveAttribute('data-route-probe', 'persistent')
    await expect(page.locator('.onboarding-progress-minimal')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Ingin menghubungkan jadwalmu?' })).toBeVisible()
    await expect(page.getByText('Pengecekan akhir', { exact: true })).toHaveCount(0)
    const calendarCard = page.locator('.onboarding-calendar-option')
    await expect(calendarCard).toBeVisible()

    for (const viewport of requiredViewports) {
      await page.setViewportSize(viewport)
      await expectNoHorizontalOverflow(page)
      await expectHorizontallyInsideViewport(page, calendarCard)
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await settleVisualCapture(page)
    await page.screenshot({ path: 'test-results/onboarding-screenshots/calendar-desktop-1440x900.png', fullPage: true })
    await page.setViewportSize({ width: 320, height: 568 })
    await page.screenshot({ path: 'test-results/onboarding-screenshots/calendar-mobile-320x568.png', fullPage: true })

    await setCalendarConnected(page, true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Google Calendar-mu sudah terhubung.' })).toBeVisible()
    await page.getByTestId('onboarding-ambient').evaluate(element => element.setAttribute('data-calendar-review-probe', 'persistent'))
    await page.getByRole('link', { name: 'Lanjut ke ringkasan', exact: true }).click()

    await expect(page).toHaveURL(/\/onboarding\/review$/)
    await expect(page.getByTestId('onboarding-ambient')).toHaveAttribute('data-calendar-review-probe', 'persistent')
    await expect(page.getByText('Pengecekan akhir', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sebelum masuk, periksa sebentar.' })).toBeVisible()
    await expect(page.getByText('Institut Teknologi Sepuluh Nopember', { exact: true })).toBeVisible()
    await expect(page.getByText(/Kasus Bisnis · UI\/UX/)).toBeVisible()
    await expect(page.getByText('Terhubung', { exact: true })).toBeVisible()
    await expect(page.getByText('yuta.onboarding.fixture.with.a.very.long.address@example.test', { exact: true })).toBeVisible()
    await expect(page.getByText('Kelola nanti di dashboard', { exact: true })).toBeVisible()
    await expect(page.getByText('Revisi data', { exact: true })).toHaveCount(0)
    const calendarReviewCard = page.locator('.onboarding-review__item--calendar')
    await expect(calendarReviewCard.getByRole('link', { name: 'Ubah', exact: true })).toHaveCount(0)

    const reviewCard = page.locator('.onboarding-review__item').first()
    const finalAction = page.getByRole('link', { name: /Semua sudah benar, masuk Strativate/ })
    for (const viewport of requiredViewports) {
      await page.setViewportSize(viewport)
      await expectNoHorizontalOverflow(page)
      await expectHorizontallyInsideViewport(page, reviewCard)
      await expectHorizontallyInsideViewport(page, finalAction)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await settleVisualCapture(page)
    await page.screenshot({ path: 'test-results/onboarding-screenshots/review-mobile-390x844.png', fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: 'test-results/onboarding-screenshots/review-desktop-1440x900.png', fullPage: true })

    const studyCard = page.locator('.onboarding-review__item').filter({ hasText: 'Tempat belajar' })
    await studyCard.getByRole('link', { name: 'Ubah', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\?revisi=1&bagian=institution$/)
    await waitForOnboardingIdle(page)
    await expect(page.getByLabel('Institusi')).toHaveValue('Institut Teknologi Sepuluh Nopember')
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Kamu mengambil jurusan atau fakultas apa?' })).toBeVisible()
    await waitForOnboardingIdle(page)
    await expect(page.getByLabel('Jurusan / fakultas')).toHaveValue('Teknik Informatika dan Rekayasa Perangkat Lunak untuk Sistem Berskala Besar')
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Kamu mulai di sana tahun berapa?' })).toBeVisible()
    await waitForOnboardingIdle(page)
    await expect(page.getByRole('spinbutton', { name: 'Tahun angkatan' })).toHaveValue('2022')
    await page.getByRole('spinbutton', { name: 'Tahun angkatan' }).fill('2023')
    await expect(page.getByRole('spinbutton', { name: 'Tahun angkatan' })).toHaveValue('2023')
    await page.getByRole('button', { name: /Simpan & lanjutkan/ }).click()

    await expect(page).toHaveURL(/\/onboarding\/review$/)
    await waitForOnboardingIdle(page)
    await expect(page.getByText(/Angkatan 2023/)).toBeVisible()

    const profileCard = page.locator('.onboarding-review__item').filter({ hasText: 'Profil akun' })
    await profileCard.getByRole('link', { name: 'Ubah', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\?revisi=1&bagian=identity$/)
    await expect(page.getByText('Yuta Fixture', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Ya, lanjutkan/ }).click()
    await expect(page.getByLabel('Nama pengguna', { exact: true })).toHaveValue('yuta_fixture')
    await waitForOnboardingIdle(page)
    await page.getByRole('button', { name: 'Lanjutkan dari nama pengguna' }).click()
    await expect(page.getByRole('heading', { name: 'Kata sandi akunmu sudah siap.' })).toBeVisible()
    await waitForOnboardingIdle(page)
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/review$/)

    const referralCard = page.locator('.onboarding-review__item').filter({ hasText: 'Menemukan Strativate dari' })
    await referralCard.getByRole('link', { name: 'Ubah', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\?revisi=1&bagian=referral$/)
    await expect(page.getByRole('button', { name: 'Instagram', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Teman atau komunitas', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/review$/)
    await expect(referralCard).toContainText('Teman atau komunitas')

    const interestsCard = page.locator('.onboarding-review__item').filter({ hasText: 'Minat yang ingin dieksplor' })
    await interestsCard.getByRole('link', { name: 'Ubah', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\?revisi=1&bagian=interests$/)
    const uiuxRevisionCard = page.locator('.onboarding-answer-card--check').filter({ hasText: 'UI/UX' })
    await expect(uiuxRevisionCard.getByRole('checkbox')).toBeChecked()
    await uiuxRevisionCard.click()
    await expect(uiuxRevisionCard.getByRole('checkbox')).not.toBeChecked()
    await page.getByRole('button', { name: /Lanjutkan dengan 1 pilihan/ }).click()
    await expect(page).toHaveURL(/\/onboarding\/review$/)
    await expect(interestsCard).toContainText('Kasus Bisnis')
    await expect(interestsCard).not.toContainText('UI/UX')

    const state = await fixtureState(page)
    expect(state.saveCalls).toBe(8)
    expect(state.mentee.onboarding_step).toBe(4)
    expect(state.mentee.onboarding_completed_at).not.toBeNull()
    expect(state.interestIds).toHaveLength(1)

    const finalActionAfterRevision = page.getByRole('link', { name: /Semua sudah benar, masuk Strativate/ })
    await finalActionAfterRevision.dblclick()
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
