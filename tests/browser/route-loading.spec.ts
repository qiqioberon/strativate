import { expect, test } from '@playwright/test'

function createGate() {
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  return { wait, release }
}

test('pending internal App Router navigation shows the compact branded loader', async ({ page }) => {
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

  const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
  const programLink = nav.getByRole('link', { name: 'Program', exact: true })
  await expect(programLink).toBeVisible()

  const navigation = programLink.click()
  const overlay = page.getByTestId('route-loading-overlay')
  await expect(overlay).toBeVisible()
  await expect(page.getByTestId('route-loading-mark')).toBeVisible()
  await expect(page.getByTestId('route-loading-wordmark')).toBeHidden()
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
