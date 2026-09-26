import { expect, test } from '@playwright/test'

function createGate() {
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  return { wait, release }
}

test('hard load warms navigation behind a progress intro before normal interaction', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')

  const intro = page.getByTestId('initial-brand-intro')
  const progress = page.getByTestId('initial-load-progress')
  const hero = page.locator('.marketing-hero')
  await expect(intro).toBeVisible()
  await expect(intro).toHaveAttribute('data-phase', 'visible')
  await expect(progress).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuemin', '1')
  await expect(progress).toHaveAttribute('aria-valuemax', '100')
  const initialValue = Number(await progress.getAttribute('aria-valuenow'))
  expect(initialValue).toBeGreaterThanOrEqual(1)
  expect(initialValue).toBeLessThanOrEqual(100)
  await expect(hero).not.toHaveClass(/is-visible/)

  await page.clock.fastForward(2400)
  await expect(progress).toHaveAttribute('aria-valuenow', '100')
  await page.clock.fastForward(180)
  await expect(intro).toHaveAttribute('data-phase', 'leaving')
  await page.clock.fastForward(250)
  await expect(intro).toHaveCount(0)
  await page.clock.fastForward(32)
  await expect(hero).toHaveClass(/is-visible/)
  await expect(page.getByRole('heading', { name: 'Win Business Competitions with Expert Mentoring' })).toBeVisible()
})

test('a cache miss navigation waits for the gated RSC response and completes cleanly', async ({ page }) => {
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
  await expect(page.getByTestId('initial-brand-intro')).toHaveCount(0, { timeout: 5000 })

  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  const programLink = nav.getByRole('link', { name: 'Programs', exact: true })
  await expect(programLink).toBeVisible()

  const navigation = programLink.click()
  await expect.poll(() => intercepted).toBe(true)

  gate.release()
  await navigation
  await expect(page).toHaveURL(/\/program$/)
  await expect(page.getByTestId('program-directory-section')).toBeVisible()
})

test('reduced motion keeps the bootstrap static while preserving progress semantics', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto('/')

  const intro = page.getByTestId('initial-brand-intro')
  const progress = page.getByTestId('initial-load-progress')
  await expect(intro).toBeVisible()
  await page.clock.fastForward(1200)
  await expect(progress).toHaveAttribute('aria-valuenow', '100')
  await page.clock.fastForward(430)
  await expect(intro).toHaveCount(0)
})
