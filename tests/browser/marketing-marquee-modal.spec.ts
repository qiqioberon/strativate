import { expect, test } from '@playwright/test'

test('homepage mentor marquee reveals compact details and opens the shared mentor dialog', async ({ page }) => {
  await page.goto('/')

  const marquee = page.getByTestId('mentor-infinite-marquee')
  const card = marquee.locator('.marketing-mentor-marquee__group:not([aria-hidden]) .marketing-mentor-marquee__card').first()
  const name = card.locator('.marketing-mentor-marquee__name')
  const details = card.locator('.marketing-mentor-marquee__details')
  const initialNameSize = Number.parseFloat(await name.evaluate((element) => getComputedStyle(element).fontSize))

  await expect(details).toHaveCSS('opacity', '0')
  await card.hover()
  await expect(details).toHaveCSS('opacity', '1')
  const compactNameSize = Number.parseFloat(await name.evaluate((element) => getComputedStyle(element).fontSize))
  expect(compactNameSize).toBeLessThan(initialNameSize)

  const mentorName = (await name.textContent())?.trim()
  await card.click()
  const dialog = page.getByTestId('mentor-detail-modal')
  await expect(dialog).toHaveAttribute('open', '')
  await expect(page.getByTestId('mentor-modal-name')).toHaveText(mentorName ?? '')

  await page.keyboard.press('Escape')
  await expect(dialog).not.toHaveAttribute('open', '')
})
