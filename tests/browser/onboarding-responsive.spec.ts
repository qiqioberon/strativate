import { expect, test, type Locator, type Page } from '@playwright/test'

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

test('authenticated onboarding layout stays within the viewport and respects reduced motion', async ({ page }) => {
  const email = process.env.ONBOARDING_E2E_EMAIL
  const password = process.env.ONBOARDING_E2E_PASSWORD
  test.skip(!email || !password, 'Set ONBOARDING_E2E_EMAIL and ONBOARDING_E2E_PASSWORD to run the authenticated onboarding visual regression.')

  await page.goto('/auth')
  await page.getByLabel('Email', { exact: true }).fill(email!)
  await page.getByLabel('Kata sandi', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.goto('/onboarding')

  await expect(page.locator('.onboarding-shell')).toBeVisible()
  const intro = page.getByRole('button', { name: 'Mulai', exact: true })
  if (await intro.count()) await intro.click()

  await expect(page.locator('.onboarding-progress')).toBeVisible()

  for (const viewport of requiredViewports) {
    await page.setViewportSize(viewport)
    await expectNoHorizontalOverflow(page)
    await expectHorizontallyInsideViewport(page, page.locator('.onboarding-heading h1'))
    await expectHorizontallyInsideViewport(page, page.locator('.onboarding-progress'))
    await expectHorizontallyInsideViewport(page, page.locator('.onboarding-actions__primary'))
  }

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.onboarding-stage')).toHaveCSS('animation-name', 'none')
})
