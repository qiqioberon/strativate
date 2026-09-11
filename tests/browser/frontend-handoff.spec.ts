import { expect, test } from '@playwright/test'

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
    await expect(page.getByText('2500+', { exact: true })).toBeVisible()
    await page.screenshot({ path: `output/playwright/handoff-home-${viewport.label}.png`, fullPage: true })

    await page.goto('/auth')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('img', { name: 'Strativate' })).toBeVisible()
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
