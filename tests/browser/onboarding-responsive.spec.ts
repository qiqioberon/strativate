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

async function fixtureState(page: Page) {
  return await (await page.request.get('http://127.0.0.1:54321/__fixture/onboarding-state')).json()
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
}

async function goToPassword(page: Page) {
  await goToUsername(page)
  await page.getByLabel('Nama pengguna', { exact: true }).fill('yuta_fixture')
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Institusi')).toHaveCount(0)
  await page.getByRole('button', { name: 'Lanjutkan dari nama pengguna' }).click()
  await expect(page.getByRole('heading', { name: /Kata sandi akunmu sudah siap|Sekarang, amankan akunmu|Akun Google-mu sudah siap/ })).toBeVisible()
  await expect(page.getByLabel('Nama pengguna', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Institusi')).toHaveCount(0)
}

async function completeIdentity(page: Page) {
  await goToPassword(page)
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saat ini kamu belajar di mana?' })).toBeVisible()
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
  await expect(page.getByText('Institut Teknologi Sepuluh Nopember', { exact: true })).toBeVisible()

  await page.getByLabel('Jurusan / fakultas').fill('Teknik Informatika dan Rekayasa Perangkat Lunak untuk Sistem Berskala Besar')
  if (exerciseBack) {
    await page.getByRole('button', { name: /Kembali/ }).click()
    await expect(page.getByLabel('Institusi')).toHaveValue('Institut Teknologi Sepuluh Nopember')
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
    await expect(page.getByLabel('Jurusan / fakultas')).toHaveValue('Teknik Informatika dan Rekayasa Perangkat Lunak untuk Sistem Berskala Besar')
  }

  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Kamu mulai di sana tahun berapa?' })).toBeVisible()
  await page.getByLabel('Tahun angkatan').fill('2022')
  await page.getByRole('button', { name: /Simpan & lanjutkan/ }).click()
  await expect(page.getByRole('heading', { name: /Kamu pertama kali menemukan/ })).toBeVisible()
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
    await expect(page.getByLabel('Nama depan')).toHaveCount(0)
    await page.getByLabel('Nama pengguna', { exact: true }).fill('yuta_fixture')
    await page.getByRole('button', { name: 'Lanjutkan dari nama pengguna' }).click()

    await expect(page.getByRole('heading', { name: 'Kata sandi akunmu sudah siap.' })).toBeVisible()
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

  test('Google password setup is visibly optional and skip preserves the canonical Step 1 contract', async ({ page }) => {
    await setOnboardingMode(page, 'google', false)
    await goToPassword(page)

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
    await page.setViewportSize({ width: 390, height: 844 })
    await completeIdentity(page)
    await completeInstitution(page, true)

    await page.reload()
    await expect(page.getByRole('heading', { name: /Kamu pertama kali menemukan/ })).toBeVisible()
    await expect(page.getByText(/Langkah [1-4] dari 4/)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Selamat datang/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'Instagram', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Apa yang paling ingin kamu eksplor di Strativate?' })).toBeVisible()

    const interestCards = page.locator('.onboarding-answer-card--check')
    expect(await interestCards.count()).toBeGreaterThanOrEqual(12)
    await page.getByText('Business Case', { exact: true }).click()
    await page.getByText('UI/UX', { exact: true }).click()
    await expect(page.getByRole('button', { name: /Lanjutkan dengan 2 pilihan/ })).toBeVisible()

    const longInterest = page.getByText('Strategi Transformasi Digital dan Inovasi Bisnis Berkelanjutan untuk Organisasi', { exact: true })
    await expect(longInterest).toBeVisible()

    mkdirSync('test-results/onboarding-screenshots', { recursive: true })
    await page.setViewportSize({ width: 390, height: 844 })
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
      await expectHorizontallyInsideViewport(page, page.getByRole('button', { name: /Lanjutkan dengan 2 pilihan/ }))
    }

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 568 })
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: /Lanjutkan dengan 2 pilihan/ }).click()

    await expect(page).toHaveURL(/\/onboarding\/calendar$/)
    await expect(page.getByRole('heading', { name: /Semua sudah siap, Yuta/ })).toBeVisible()
    await expect(page.getByText('Institut Teknologi Sepuluh Nopember', { exact: true })).toBeVisible()
    await expect(page.getByText(/Business Case · UI\/UX/)).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectHorizontallyInsideViewport(page, page.locator('.onboarding-calendar-option'))

    await expect(page.getByRole('link', { name: /Hubungkan Google Calendar/ })).toBeVisible()
    await page.screenshot({ path: 'test-results/onboarding-screenshots/completion-mobile-320x568.png', fullPage: true })
    await page.getByRole('link', { name: 'Lewati sekarang', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const state = await fixtureState(page)
    expect(state.saveCalls).toBe(4)
    expect(state.mentee.onboarding_step).toBe(4)
    expect(state.mentee.onboarding_completed_at).not.toBeNull()
    expect(state.interestIds).toHaveLength(2)
  })
})
