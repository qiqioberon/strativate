import { expect, test, type Locator, type Page } from '@playwright/test'

const widths = [390, 430, 768, 1440, 1920] as const
const recognitionStatement = 'Our mentors and students are award-winning business competition finalists.'

async function waitForBrandIntro(page: Page) {
  const intro = page.getByTestId('initial-brand-intro')
  if (await intro.count()) await expect(intro).toBeHidden({ timeout: 10000 })
}

async function seamOverlaps(cloud: Locator) {
  return cloud.evaluate((node) => {
    const cloudTop = node.getBoundingClientRect().top
    return Array.from(node.querySelectorAll<HTMLElement>('.homepage-hero-cloud__lobes span')).map((lobe) => (
      lobe.getBoundingClientRect().bottom - cloudTop
    ))
  })
}

for (const width of widths) {
  test(`homepage recognition and cloud seam remain complete at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 430 ? 900 : 1000 })
    await page.goto('/')
    await waitForBrandIntro(page)

    const hero = page.getByTestId('homepage-hero-section')
    const cloud = page.getByTestId('homepage-hero-cloud')
    const stats = page.getByTestId('homepage-social-proof')
    const recognition = page.getByTestId('homepage-recognition-section')
    const whoWeAre = page.getByTestId('homepage-who-we-are-section')

    await expect(hero).toBeVisible()
    await expect(cloud).toBeVisible()
    await expect(stats).toBeVisible()
    await recognition.scrollIntoViewIfNeeded()
    await expect(recognition).toBeVisible()
    await expect(recognition).toContainText(recognitionStatement)
    await expect(page.getByTestId('homepage-recognition-logo-wall')).toHaveCount(0)
    await whoWeAre.scrollIntoViewIfNeeded()
    await expect(whoWeAre).toBeVisible()

    const documentOrder = await page.evaluate(() => {
      const ids = [
        'homepage-hero-section',
        'homepage-hero-cloud',
        'homepage-social-proof',
        'homepage-recognition-section',
        'homepage-who-we-are-section',
      ]
      const nodes = ids.map(id => document.querySelector(`[data-testid="${id}"]`))
      return nodes.every(Boolean) && nodes.every((node, index) => (
        index === 0 || Boolean(nodes[index - 1]!.compareDocumentPosition(node!) & Node.DOCUMENT_POSITION_FOLLOWING)
      ))
    })
    expect(documentOrder).toBe(true)
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)

    const initialOverlap = await seamOverlaps(cloud)
    expect(initialOverlap).toHaveLength(7)
    expect(Math.min(...initialOverlap), `initial overlaps: ${initialOverlap.join(', ')}`).toBeGreaterThanOrEqual(3)
    await page.waitForTimeout(450)
    const delayedOverlap = await seamOverlaps(cloud)
    expect(Math.min(...delayedOverlap), `delayed overlaps: ${delayedOverlap.join(', ')}`).toBeGreaterThanOrEqual(3)

    const recognitionStyles = await recognition.evaluate((node) => {
      const style = getComputedStyle(node)
      const section = node.getBoundingClientRect()
      const heading = node.querySelector('h2')!.getBoundingClientRect()
      const hero = document.querySelector<HTMLElement>('[data-testid="homepage-hero-section"]')!.getBoundingClientRect()
      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        headingInsideSection: heading.left >= section.left && heading.right <= section.right,
        touchesHero: Math.abs(section.top - hero.bottom) <= 1,
      }
    })
    expect(recognitionStyles.backgroundImage).toBe('none')
    expect(recognitionStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(recognitionStyles.borderTopWidth).toBe('0px')
    expect(recognitionStyles.boxShadow).toBe('none')
    expect(recognitionStyles.headingInsideSection).toBe(true)
    expect(recognitionStyles.touchesHero).toBe(true)
  })
}

test('recognition logo wall contains wide, square, and tall original-color logos', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 })
  await page.goto('/')
  await waitForBrandIntro(page)

  const recognition = page.getByTestId('homepage-recognition-section')
  await recognition.evaluate((section) => {
    const image = (name: string, width: number, height: number, color: string) => {
      const logo = document.createElement('img')
      logo.alt = name
      logo.width = 220
      logo.height = 96
      logo.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`)}`
      return logo
    }
    const wall = document.createElement('div')
    wall.className = 'homepage-recognition__logo-wall'
    wall.dataset.testid = 'homepage-recognition-logo-wall-probe'
    wall.append(
      image('Wide Competition', 320, 80, '#d62828'),
      image('Square Competition', 160, 160, '#2a9d8f'),
      image('Tall Competition', 80, 240, '#264653'),
    )
    section.querySelector('.homepage-recognition__inner')!.append(wall)
  })

  const wall = page.getByTestId('homepage-recognition-logo-wall-probe')
  await wall.scrollIntoViewIfNeeded()
  const result = await wall.evaluate(async (node) => {
    const images = Array.from(node.querySelectorAll('img'))
    await Promise.all(images.map(image => image.decode()))
    const wallBox = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return {
      display: style.display,
      flexWrap: style.flexWrap,
      justifyContent: style.justifyContent,
      images: images.map(image => {
        const box = image.getBoundingClientRect()
        return {
          alt: image.alt,
          objectFit: getComputedStyle(image).objectFit,
          inside: box.left >= wallBox.left && box.right <= wallBox.right,
          aspectRatio: image.naturalWidth / image.naturalHeight,
        }
      }),
    }
  })

  expect(result.display).toBe('flex')
  expect(result.flexWrap).toBe('wrap')
  expect(result.justifyContent).toBe('center')
  expect(result.images.map(image => image.alt)).toEqual(['Wide Competition', 'Square Competition', 'Tall Competition'])
  expect(result.images.every(image => image.objectFit === 'contain' && image.inside)).toBe(true)
  expect(result.images.map(image => image.aspectRatio)).toEqual([4, 1, 1 / 3])
})
