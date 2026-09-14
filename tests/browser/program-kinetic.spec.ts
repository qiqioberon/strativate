import { expect, test } from '@playwright/test'

test('program page exposes kinetic bento interactions without breaking layout', async ({ page }) => {
  await page.goto('/program')

  await expect(page.getByTestId('program-kinetic-surface')).toBeVisible()
  await expect(page.getByText('Pilih kebutuhan', { exact: true })).toBeVisible()
  await expect(page.getByText('Kenali format', { exact: true })).toBeVisible()
  await expect(page.getByText('Mulai persiapan', { exact: true })).toBeVisible()

  const privateCard = page.getByTestId('service-card-private-mentoring')
  await privateCard.hover({ position: { x: 180, y: 120 } })
  await expect.poll(() => privateCard.evaluate((node) => getComputedStyle(node).getPropertyValue('--program-card-x').trim())).not.toBe('')

  const secondary = page.getByTestId('service-card-big-class')
  const primaryBox = await privateCard.boundingBox()
  const secondaryBox = await secondary.boundingBox()
  expect(primaryBox).not.toBeNull()
  expect(secondaryBox).not.toBeNull()
  expect(secondaryBox!.width).toBeGreaterThan(primaryBox!.width * 1.5)
})

test('program kinetic layout remains within the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/program')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
