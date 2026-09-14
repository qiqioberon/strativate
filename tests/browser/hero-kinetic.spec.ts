import { expect, test } from '@playwright/test'

test('homepage hero adds kinetic depth without changing its primary destinations', async ({ page }) => {
  await page.goto('/')

  const surface = page.getByTestId('hero-kinetic-surface')
  const stage = page.getByTestId('hero-kinetic-stage')
  await expect(surface).toBeVisible()
  await expect(stage.locator('.marketing-hero-stage__node')).toHaveCount(3)
  await expect(page.getByTestId('hero-program-link')).toHaveAttribute('href', '/program')
  await expect(page.getByTestId('hero-mentor-link')).toHaveAttribute('href', '/mentor')
  await expect(page.getByTestId('hero-mentor-link')).toHaveAttribute('data-magnetic-action', 'true')

  const stageBox = await stage.boundingBox()
  if (!stageBox) throw new Error('Expected kinetic hero stage bounds')
  await page.mouse.move(stageBox.x + stageBox.width * .8, stageBox.y + stageBox.height * .25)
  const tilt = await stage.evaluate((element) => element.style.getPropertyValue('--hero-tilt-y'))
  expect(tilt).not.toBe('0deg')

  const mentor = page.getByTestId('hero-mentor-link')
  const mentorBox = await mentor.boundingBox()
  if (!mentorBox) throw new Error('Expected mentor CTA bounds')
  await page.mouse.move(mentorBox.x + mentorBox.width * .8, mentorBox.y + mentorBox.height * .25)
  const magneticX = await mentor.evaluate((element) => element.style.getPropertyValue('--magnet-x'))
  expect(magneticX).not.toBe('0px')
})

test('kinetic hero stays static when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const stage = page.getByTestId('hero-kinetic-stage')
  const stageBox = await stage.boundingBox()
  if (!stageBox) throw new Error('Expected kinetic hero stage bounds')
  await page.mouse.move(stageBox.x + stageBox.width * .8, stageBox.y + stageBox.height * .25)
  await expect(stage.locator('.marketing-hero-stage__card')).toHaveCSS('transform', 'none')
  await expect(stage.locator('.marketing-hero-stage__node').first()).toHaveCSS('animation-name', 'none')
})
