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

test('pending internal navigation keeps the current UI visible without a global loader', async ({ page }) => {
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
  await expect(page.getByTestId('initial-brand-intro')).toHaveCount(0, { timeout: 2000 })

  const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
  const programLink = nav.getByRole('link', { name: 'Program', exact: true })
  await expect(programLink).toBeVisible()

  const navigation = programLink.click()
  await expect.poll(() => intercepted).toBe(true)
  await expect(page.getByTestId('route-loading-overlay')).toHaveCount(0)
  await expect(nav).toBeVisible()
  await expect(page.getByTestId('initial-brand-intro')).toHaveCount(0)

  gate.release()
  await navigation
  await expect(page).toHaveURL(/\/program$/)
  await expect(page.getByTestId('program-directory-section')).toBeVisible()
})

test('reduced motion shortens only the initial intro and never enables a route overlay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto('/')

  const intro = page.getByTestId('initial-brand-intro')
  await expect(intro).toBeVisible()
  await page.clock.fastForward(240)
  await expect(intro).toHaveCount(0)
  await expect(page.getByTestId('route-loading-overlay')).toHaveCount(0)
})
