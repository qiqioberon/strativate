import { expect, test } from '@playwright/test'

const responsiveMatrix = [
  { width: 360, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1280, height: 1000 },
  { width: 1440, height: 1000 },
  { width: 1920, height: 1080 },
] as const

const publicRoutes = [
  ['/', 'homepage-hero-section', 'hero-whatsapp-link'],
  ['/program', 'marketing-page-title', 'program-page-intro-whatsapp-link'],
  ['/mentor', 'marketing-page-title', 'mentor-page-intro-whatsapp-link'],
  ['/tentang-kami', 'about-story-section', 'global-whatsapp-cta'],
  ['/tanya-jawab', 'faq-reference-hero', 'global-whatsapp-cta'],
  ['/auth', 'auth-back-link', 'auth-mode-switch'],
] as const

for (const viewport of [
  { label: 'desktop', width: 1440, height: 1000 },
  { label: 'tablet', width: 1024, height: 768 },
  { label: 'mobile', width: 390, height: 844 },
]) {
  test(`frontend handoff renders core public surfaces on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('img', { name: 'Strativate' }).first()).toBeVisible()
    await expect(page.getByText('2,500+', { exact: true })).toBeVisible()
    await page.screenshot({ path: `output/playwright/handoff-home-${viewport.label}.png`, fullPage: true })

    await page.goto('/auth')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('img', { name: 'Strativate' }).first()).toBeVisible()
    await page.screenshot({ path: `output/playwright/handoff-auth-${viewport.label}.png`, fullPage: true })

    await page.goto('/program')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.marketing-service-card')).toHaveCount(8)
    await page.screenshot({ path: `output/playwright/handoff-program-${viewport.label}.png`, fullPage: true })

    await page.goto('/mentor')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.marketing-mentor-card')).toHaveCount(26)
    await expect(page.locator('.asset-media[data-asset-status="missing"]')).toHaveCount(7)
    for (const card of await page.locator('.marketing-mentor-card').all()) await card.scrollIntoViewIfNeeded()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `output/playwright/handoff-mentor-${viewport.label}.png`, fullPage: true })

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}

test('public marketing and auth routes remain actionable and overflow-safe throughout the responsive matrix', async ({ page }) => {
  test.setTimeout(90_000)

  for (const viewport of responsiveMatrix) {
    await page.setViewportSize(viewport)

    for (const [route, landmarkTestId, actionTestId] of publicRoutes) {
      await page.goto(route)
      await expect(page.getByTestId(landmarkTestId)).toBeVisible()
      await expect(page.getByTestId(actionTestId)).toBeVisible()
      await page.getByTestId(actionTestId).focus()
      await expect(page.getByTestId(actionTestId)).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

      if (viewport.width === 360 && route === '/') {
        const menuToggle = page.getByTestId('mobile-menu-toggle-button')
        await menuToggle.click()
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'true')
        await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
        await menuToggle.press('Escape')
        await expect(menuToggle).toHaveAttribute('aria-expanded', 'false')
      }

      if (viewport.width === 390 && route === '/mentor') {
        await page.getByTestId('mentor-navira-putri-detail-button').click()
        const dialog = page.getByTestId('mentor-detail-modal')
        await expect(dialog).toHaveAttribute('open', '')
        const columns = await dialog.locator('.marketing-mentor-dialog__panel').evaluate(panel => getComputedStyle(panel).gridTemplateColumns.trim().split(/\s+/).length)
        expect(columns).toBe(1)
        await page.keyboard.press('Escape')
        await expect(dialog).not.toHaveAttribute('open', '')
      }
    }
  }
})
