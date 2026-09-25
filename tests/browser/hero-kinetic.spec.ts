import { expect, test } from '@playwright/test'

test('homepage opening integrates the header, centered hero, consultation CTA, proof cloud, and gallery when published', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  await expect(page.getByRole('banner')).toHaveClass(/marketing-header--home/)
  await expect(page.getByRole('heading', { level: 1, name: 'Win Business Competitions with Expert Mentoring' })).toBeVisible()
  await expect(page.getByText('Transform your ideas into winning strategies. Get personalized guidance from experienced mentors and achieve podium finishes.', { exact: true })).toBeVisible()

  const shapeGrid = page.getByTestId('hero-shape-grid')
  await expect(shapeGrid).toBeVisible()
  await expect(shapeGrid.locator('.homepage-shape-grid__shape')).toHaveCount(35)
  await expect(shapeGrid).toHaveCSS('pointer-events', 'none')

  const consultation = page.getByTestId('hero-whatsapp-link')
  await expect(consultation).toBeVisible()
  await expect(consultation).toHaveText(/Consultation/)
  await expect(consultation).toHaveAttribute('target', '_blank')
  await expect(consultation).toHaveAttribute('href', /^https:\/\/wa\.me\//)

  const cloud = page.getByTestId('homepage-hero-cloud')
  await expect(cloud).toBeVisible()
  await expect(cloud.locator('.homepage-hero-cloud__lobes span')).toHaveCount(7)

  const socialProof = page.getByTestId('homepage-social-proof')
  await expect(socialProof.locator('article')).toHaveCount(3)
  await expect(socialProof.getByText('2,500+', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('15+', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('20+', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('Students supported', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('Universities', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('High schools', { exact: true })).toBeVisible()

  const galleryRegion = page.getByTestId('homepage-success-proof-section')
  if (await galleryRegion.count()) {
    await expect(galleryRegion.getByTestId('testimonial-circular-gallery')).toBeVisible()
  }

  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})

test('homepage opening respects reduced motion and remains complete on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const shape = page.getByTestId('hero-shape-grid').locator('.homepage-shape-grid__shape').first()
  await expect(shape).toHaveCSS('animation-name', 'none')
  await expect(page.getByTestId('hero-whatsapp-link')).toBeVisible()
  await expect(page.getByTestId('homepage-hero-cloud')).toBeVisible()
  await expect(page.getByTestId('homepage-social-proof').locator('article')).toHaveCount(3)

  const menuToggle = page.getByTestId('mobile-menu-toggle-button')
  await expect(menuToggle).toBeVisible()
  await menuToggle.click()
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()

  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})
