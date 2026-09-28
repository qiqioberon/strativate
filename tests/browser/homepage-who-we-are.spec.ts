import { expect, test, type Page } from '@playwright/test'

const widths = [390, 430, 768, 1440, 1920] as const

async function waitForBrandIntro(page: Page) {
  const intro = page.getByTestId('initial-brand-intro')
  if (await intro.count()) await expect(intro).toBeHidden({ timeout: 10000 })
}

async function mountCollage(page: Page, count: 0 | 1 | 2 | 3, failedRole?: string) {
  await page.getByTestId('homepage-who-we-are-section').evaluate((section, options) => {
    section.querySelector('.homepage-who__collage')?.remove()
    section.classList.toggle('homepage-who--empty', options.count === 0)
    if (!options.count) return

    const roles = ['primary', 'upper_right', 'lower_right'].slice(0, options.count)
    const collage = document.createElement('div')
    collage.className = 'homepage-who__collage'
    collage.dataset.count = String(options.count)
    collage.dataset.testid = 'homepage-who-we-are-collage'
    collage.setAttribute('aria-label', 'Strativate community photos')

    roles.forEach((role, index) => {
      if (role === options.failedRole) return
      const figure = document.createElement('figure')
      figure.className = `homepage-who__frame homepage-who__${role}`
      figure.dataset.role = role
      const image = document.createElement('img')
      image.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="${['#d96c31', '#687f71', '#d0a55a'][index]}"/><circle cx="50%" cy="42%" r="24%" fill="rgba(255,255,255,.34)"/></svg>`)}`
      image.alt = `Editorial fixture ${index + 1}`
      figure.append(image)
      if (index === 0) {
        const badge = document.createElement('figcaption')
        badge.textContent = 'Collaborative preparation'
        figure.append(badge)
      }
      collage.append(figure)
    })
    section.querySelector('.homepage-who__layout')!.append(collage)
  }, { count, failedRole })
}

for (const width of widths) {
  test(`Who We Are hierarchy and collage remain balanced at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 430 ? 900 : 1050 })
    await page.goto('/')
    await waitForBrandIntro(page)
    await mountCollage(page, 3)

    const section = page.getByTestId('homepage-who-we-are-section')
    const collage = page.getByTestId('homepage-who-we-are-collage')
    await section.scrollIntoViewIfNeeded()
    await expect(section).toContainText('WHO WE ARE')
    await expect(section.getByRole('heading', { name: 'Where Future-Ready Skills Meet Competition Success' })).toBeVisible()
    await expect(section.getByRole('link', { name: 'Learn More About Us' })).toHaveAttribute('href', '/tentang-kami')
    await expect(collage.locator('figure')).toHaveCount(3)

    const geometry = await section.evaluate(node => {
      const copy = node.querySelector<HTMLElement>('.homepage-who__copy')!.getBoundingClientRect()
      const collage = node.querySelector<HTMLElement>('.homepage-who__collage')!.getBoundingClientRect()
      const primary = node.querySelector<HTMLElement>('.homepage-who__primary')!.getBoundingClientRect()
      const upper = node.querySelector<HTMLElement>('.homepage-who__upper_right')!.getBoundingClientRect()
      const lower = node.querySelector<HTMLElement>('.homepage-who__lower_right')!.getBoundingClientRect()
      const cta = node.querySelector<HTMLElement>('.homepage-who__cta')!
      const heading = node.querySelector<HTMLElement>('.homepage-who__copy h2')!
      const lede = node.querySelector<HTMLElement>('.homepage-who__lede')!
      const kicker = node.querySelector<HTMLElement>('.homepage-who__copy > .marketing-kicker')!
      const headingStyle = getComputedStyle(heading)
      const ledeStyle = getComputedStyle(lede)
      const kickerStyle = getComputedStyle(kicker)
      const headingLineHeight = Number.parseFloat(headingStyle.lineHeight)
      return {
        copyBeforeCollage: copy.top < collage.top || copy.left < collage.left,
        stacked: collage.top >= copy.bottom - 1,
        primaryDominant: primary.height > upper.height && primary.height > lower.height,
        supportsBalanced: Math.abs(primary.width - upper.width) <= 32 && Math.abs(upper.width - lower.width) <= 8,
        supportSquares: Math.abs(upper.width - upper.height) <= 4 && Math.abs(lower.width - lower.height) <= 4,
        collageCapped: collage.width <= 651,
        supportsReadable: upper.width >= 180 && lower.width >= 180,
        ctaWidth: cta.getBoundingClientRect().width,
        ctaHeight: cta.getBoundingClientRect().height,
        copyWidth: copy.width,
        ctaBackground: getComputedStyle(cta).backgroundColor,
        headingLines: heading.getBoundingClientRect().height / headingLineHeight,
        ledeMarginTop: Number.parseFloat(ledeStyle.marginTop),
        ledeFontSize: Number.parseFloat(ledeStyle.fontSize),
        kickerFontSize: Number.parseFloat(kickerStyle.fontSize),
      }
    })

    expect(geometry.copyBeforeCollage).toBe(true)
    expect(geometry.primaryDominant).toBe(true)
    expect(geometry.supportsBalanced).toBe(true)
    expect(geometry.supportSquares).toBe(true)
    expect(geometry.collageCapped).toBe(true)
    expect(geometry.supportsReadable).toBe(true)
    expect(geometry.ctaWidth).toBeLessThan(geometry.copyWidth * .8)
    expect(geometry.ctaHeight).toBeGreaterThanOrEqual(50)
    expect(geometry.ctaBackground).not.toBe('rgba(0, 0, 0, 0)')
    expect(geometry.ledeMarginTop).toBeGreaterThanOrEqual(width <= 520 ? 30 : 34)
    expect(geometry.ledeFontSize).toBeGreaterThanOrEqual(16)
    expect(geometry.kickerFontSize).toBeGreaterThanOrEqual(12)
    if (width <= 430) {
      expect(geometry.headingLines).toBeGreaterThanOrEqual(2.7)
      expect(geometry.headingLines).toBeLessThanOrEqual(3.3)
    }
    expect(geometry.stacked).toBe(width <= 900)
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
  })
}

test('Who We Are zero, one, two, and failed-image states leave no broken frame', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 })
  await page.goto('/')
  await waitForBrandIntro(page)
  const section = page.getByTestId('homepage-who-we-are-section')

  await mountCollage(page, 0)
  await expect(page.getByTestId('homepage-who-we-are-collage')).toHaveCount(0)
  await expect(section.getByRole('link', { name: 'Learn More About Us' })).toBeVisible()

  await mountCollage(page, 1)
  await expect(page.getByTestId('homepage-who-we-are-collage').locator('figure')).toHaveCount(1)
  await mountCollage(page, 2)
  await expect(page.getByTestId('homepage-who-we-are-collage').locator('figure')).toHaveCount(2)
  await mountCollage(page, 3, 'upper_right')
  await expect(page.getByTestId('homepage-who-we-are-collage').locator('figure')).toHaveCount(2)
  await expect(page.getByTestId('homepage-who-we-are-collage').locator('figcaption')).toHaveText('Collaborative preparation')

  await mountCollage(page, 3, 'primary')
  const failedPrimaryBalance = await page.getByTestId('homepage-who-we-are-collage').evaluate(node => {
    const collage = node.getBoundingClientRect()
    const frames = Array.from(node.querySelectorAll('figure')).map(frame => frame.getBoundingClientRect())
    const occupiedLeft = Math.min(...frames.map(frame => frame.left))
    const occupiedRight = Math.max(...frames.map(frame => frame.right))
    return (occupiedRight - occupiedLeft) / collage.width
  })
  expect(failedPrimaryBalance).toBeGreaterThan(.75)
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})

test('a real image load failure removes its frame and rebalances the remaining collage', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 })
  await page.goto('http://localhost:3001/who-we-are')

  const collage = page.getByTestId('homepage-who-we-are-collage')
  await expect(collage.locator('figure')).toHaveCount(2)
  await expect(collage.locator('[data-role="primary"]')).toHaveCount(0)

  const occupiedRatio = await collage.evaluate(node => {
    const bounds = node.getBoundingClientRect()
    const frames = Array.from(node.querySelectorAll('figure')).map(frame => frame.getBoundingClientRect())
    return (Math.max(...frames.map(frame => frame.right)) - Math.min(...frames.map(frame => frame.left))) / bounds.width
  })
  expect(occupiedRatio).toBeGreaterThan(.75)
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})
