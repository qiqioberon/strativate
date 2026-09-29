import { expect, test } from '@playwright/test'

async function waitForBrandIntro(page: import('@playwright/test').Page) {
  const intro = page.getByTestId('initial-brand-intro')
  if (await intro.count()) await expect(intro).toBeHidden({ timeout: 6000 })
}

async function canvasSample(canvas: import('@playwright/test').Locator) {
  return canvas.evaluate((node) => {
    const element = node as HTMLCanvasElement
    const context = element.getContext('2d')
    if (!context) throw new Error('Expected a 2D canvas context')
    const width = Math.min(96, element.width)
    const height = Math.min(96, element.height)
    const data = context.getImageData(Math.max(0, Math.floor((element.width - width) / 2)), 0, width, height).data
    let hash = 2166136261
    for (let index = 0; index < data.length; index += 16) {
      hash ^= data[index] + data[index + 1] * 3 + data[index + 2] * 7 + data[index + 3] * 11
      hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
  })
}

test('homepage opening integrates the header, centered hero, consultation CTA, proof cloud, and gallery when published', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  const intro = page.getByTestId('initial-brand-intro')
  const introGallery = page.getByTestId('testimonial-circular-gallery')
  if (await introGallery.count()) {
    await expect(intro).toBeVisible()
    await expect(introGallery).toHaveAttribute('data-intro-state', 'pending')
  }

  await waitForBrandIntro(page)

  if (await introGallery.count()) {
    await expect(introGallery).toHaveAttribute('data-intro-state', 'running', { timeout: 1600 })
    const introOrder = (await introGallery.getAttribute('data-intro-order') ?? '')
      .split(',')
      .filter(Boolean)
      .map(Number)
    expect(introOrder.length).toBeGreaterThanOrEqual(3)
    expect(introOrder).toEqual([...introOrder].sort((a, b) => a - b))
    await expect(introGallery).toHaveAttribute('data-intro-state', 'complete', { timeout: 2600 })
  }

  await expect(page.getByRole('banner')).toHaveClass(/marketing-header--home/)
  await expect(page.getByRole('heading', { level: 1, name: 'Win Business Competitions with Expert Mentoring' })).toBeVisible()
  await expect(page.getByText('Transform your ideas into winning strategies. Get personalized guidance from experienced mentors and achieve podium finishes.', { exact: true })).toBeVisible()

  const shapeGrid = page.getByTestId('hero-shape-grid')
  await expect(shapeGrid).toBeVisible()
  await expect(shapeGrid).toHaveAttribute('data-react-bits', 'shape-grid')
  await expect(shapeGrid).toHaveAttribute('data-motion', 'animated')
  await expect(shapeGrid).toHaveCSS('pointer-events', 'none')
  await expect(shapeGrid.evaluate(node => node.tagName)).resolves.toBe('CANVAS')

  const initialSample = await canvasSample(shapeGrid)
  await page.waitForTimeout(350)
  const ambientSample = await canvasSample(shapeGrid)
  expect(ambientSample).not.toBe(initialSample)

  const shapeGridBox = await shapeGrid.boundingBox()
  if (!shapeGridBox) throw new Error('Expected Shape Grid bounds')
  await page.mouse.move(shapeGridBox.x + shapeGridBox.width / 2, shapeGridBox.y + shapeGridBox.height / 2)
  await page.waitForTimeout(100)
  const pointerSample = await canvasSample(shapeGrid)
  expect(pointerSample).not.toBe(ambientSample)

  const consultation = page.getByTestId('hero-whatsapp-link')
  await expect(consultation).toBeVisible()
  await expect(consultation).toHaveText(/Consultation/)
  await expect(consultation).toHaveAttribute('target', '_blank')
  await expect(consultation).toHaveAttribute('href', /^https:\/\/wa\.me\//)
  const popupPromise = page.waitForEvent('popup')
  await consultation.click()
  const popup = await popupPromise
  await popup.close()

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
    const gallery = galleryRegion.getByTestId('testimonial-circular-gallery')
    await expect(gallery).toBeVisible()
    const box = await gallery.boundingBox()
    if (!box) throw new Error('Expected testimonial gallery bounds')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const popout = gallery.getByTestId('testimonial-active-popout')
    await expect(popout).toBeVisible()
    await expect(popout).toHaveAttribute('data-popout-state', 'raised')
    await expect(popout).toHaveCSS('z-index', '8')
    await expect(popout.locator('.marketing-testimonial-gallery__overlay-image')).toBeVisible()

    await page.setViewportSize({ width: 2560, height: 1200 })
    const wideBox = await galleryRegion.boundingBox()
    if (!wideBox) throw new Error('Expected wide testimonial gallery bounds')
    expect(wideBox.width).toBeGreaterThan(2500)
  }

  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})

test('homepage opening respects reduced motion and remains complete on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForBrandIntro(page)

  const reducedGallery = page.getByTestId('testimonial-circular-gallery')
  if (await reducedGallery.count()) {
    await expect(reducedGallery).toHaveAttribute('data-intro-state', 'complete')
  }

  const shapeGrid = page.getByTestId('hero-shape-grid')
  await expect(shapeGrid).toHaveAttribute('data-react-bits', 'shape-grid')
  await expect(shapeGrid).toHaveAttribute('data-motion', 'reduced')
  await expect(shapeGrid).toHaveCSS('pointer-events', 'none')
  const consultation = page.getByTestId('hero-whatsapp-link')
  await expect(consultation).toBeVisible()
  await expect(consultation).toBeEnabled()
  const cloud = page.getByTestId('homepage-hero-cloud')
  await expect(cloud).toBeVisible()
  const lobeAnimationNames = await cloud.locator('.homepage-hero-cloud__lobes span').evaluateAll((lobes) => (
    lobes.map(lobe => getComputedStyle(lobe).animationName)
  ))
  expect(lobeAnimationNames).toEqual(Array(7).fill('none'))
  await expect(page.getByTestId('homepage-social-proof').locator('article')).toHaveCount(3)

  const menuToggle = page.getByTestId('mobile-menu-toggle-button')
  await expect(menuToggle).toBeVisible()
  await menuToggle.click()
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
  await expect(page.locator('#marketing-mobile-navigation')).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(page.getByTestId('mobile-nav-compass-link')).toHaveCSS('color', 'rgb(0, 0, 0)')

  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})
