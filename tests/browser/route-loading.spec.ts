import { expect, test } from '@playwright/test'

function createGate() {
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  return { wait, release }
}

test('hard load uses a dedicated wordmark intro before normal interaction', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')

  const intro = page.getByTestId('initial-brand-intro')
  await expect(intro).toBeVisible()
  await expect(intro).toHaveAttribute('data-phase', 'visible')
  await expect(intro.locator('img')).toBeVisible()

  await page.clock.fastForward(650)
  await expect(intro).toHaveAttribute('data-phase', 'leaving')
  await page.clock.fastForward(250)
  await expect(intro).toHaveCount(0)
})

test('pending internal App Router navigation shows only the compact branded loader', async ({ page }) => {
  const gate = createGate()
  let intercepted = false

  await page.route('**/program**', async (route) => {
    const headers = route.request().headers()
    if (!intercepted && headers.rsc === '1') {
      intercepted = true
      await gate.wait
    }
    await route.continue()
  })

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-strativate-client-ready', 'true')
  await expect(page.getByTestId('initial-brand-intro')).toHaveCount(0, { timeout: 2000 })

  const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
  const programLink = nav.getByRole('link', { name: 'Program', exact: true })
  await expect(programLink).toBeVisible()

  const navigation = programLink.click()
  const overlay = page.getByTestId('route-loading-overlay')
  await expect(overlay).toBeVisible()
  await expect(page.getByTestId('route-loading-mark')).toBeVisible()
  await expect(page.getByTestId('route-loading-wordmark')).toHaveCount(0)
  expect(intercepted).toBe(true)

  gate.release()
  await navigation
  await expect(page).toHaveURL(/\/program$/)
  await expect(overlay).toHaveCount(0)
  await expect(page.getByTestId('program-directory-section')).toBeVisible()
})

test('reduced motion keeps the route loader static while navigation is pending', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const gate = createGate()
  let intercepted = false

  await page.route('**/program**', async (route) => {
    const headers = route.request().headers()
    if (!intercepted && headers.rsc === '1') {
      intercepted = true
      await gate.wait
    }
    await route.continue()
  })

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-strativate-client-ready', 'true')
  await expect(page.getByTestId('initial-brand-intro')).toHaveCount(0, { timeout: 1000 })

  const programLink = page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .getByRole('link', { name: 'Program', exact: true })
  const navigation = programLink.click()

  const overlay = page.getByTestId('route-loading-overlay')
  await expect(overlay).toBeVisible()
  await expect(page.getByTestId('route-loading-mark').locator('img')).toHaveCSS('animation-name', 'none')
  expect(intercepted).toBe(true)

  gate.release()
  await navigation
  await expect(page).toHaveURL(/\/program$/)
  await expect(overlay).toHaveCount(0)
})
