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

async function mountRecognitionLogos(page: Page, count: number) {
  await page.getByTestId('homepage-recognition-section').evaluate((section, logoCount) => {
    section.querySelector('.homepage-recognition__logos')?.remove()

    const dimensions = [
      [320, 80],
      [160, 160],
      [80, 240],
      [280, 120],
    ] as const
    const colors = ['#d62828', '#2a9d8f', '#264653', '#f4a261']
    const records = Array.from({ length: logoCount }, (_, index) => {
      const [width, height] = dimensions[index % dimensions.length]
      return {
        id: `recognition-${index + 1}`,
        name: `Competition ${index + 1}`,
        src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${colors[index % colors.length]}"/></svg>`)}`,
      }
    })
    const logo = (record: typeof records[number], hidden: boolean, instance: string) => {
      const slot = document.createElement('span')
      slot.className = 'homepage-recognition__logo'
      if (hidden) slot.setAttribute('aria-hidden', 'true')
      const image = document.createElement('img')
      image.alt = hidden ? '' : record.name
      image.src = record.src
      image.width = 220
      image.height = 96
      image.draggable = false
      image.tabIndex = -1
      image.dataset.recognitionId = record.id
      image.dataset.recognitionInstance = instance
      slot.append(image)
      return slot
    }
    const cycle = (rowRecords: typeof records, duplicate: boolean) => {
      const node = document.createElement('div')
      node.className = 'homepage-recognition__logo-cycle'
      if (duplicate) node.setAttribute('aria-hidden', 'true')
      const repetitions = Math.ceil(12 / rowRecords.length)
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        rowRecords.forEach(record => node.append(logo(record, duplicate || repetition > 0, `${duplicate ? 'duplicate' : 'source'}-${repetition}`)))
      }
      return node
    }
    const row = (rowRecords: typeof records, reverse = false) => {
      const node = document.createElement('div')
      node.className = `homepage-recognition__logo-row homepage-recognition__logo-row--${reverse ? 'reverse' : 'forward'}`
      node.dataset.direction = reverse ? 'reverse' : 'forward'
      const track = document.createElement('div')
      track.className = 'homepage-recognition__logo-track'
      track.append(cycle(rowRecords, false), cycle(rowRecords, true))
      node.append(track)
      return node
    }

    const logos = document.createElement('div')
    logos.className = 'homepage-recognition__logos'
    logos.dataset.testid = 'homepage-recognition-logo-section'
    const wall = document.createElement('div')
    wall.className = 'homepage-recognition__logo-wall'
    wall.dataset.testid = 'homepage-recognition-logo-wall'
    if (logoCount === 1) {
      wall.classList.add('homepage-recognition__logo-wall--static')
      wall.append(logo(records[0], false, 'static'))
    } else {
      const usesTwoRows = logoCount >= 8
      wall.classList.add('homepage-recognition__logo-wall--animated')
      if (usesTwoRows) wall.classList.add('homepage-recognition__logo-wall--two-rows')
      wall.append(row(usesTwoRows ? records.filter((_record, index) => index % 2 === 0) : records))
      if (usesTwoRows) wall.append(row(records.filter((_record, index) => index % 2 === 1), true))
    }
    logos.append(wall)
    if (logoCount > 1) {
      const reduced = document.createElement('div')
      reduced.className = 'homepage-recognition__reduced-grid'
      records.forEach(record => reduced.append(logo(record, false, 'reduced')))
      logos.append(reduced)
    }
    section.append(logos)
  }, count)
}

async function mountEmptyRecognition(page: Page) {
  await page.getByTestId('homepage-recognition-section').evaluate((section) => {
    section.querySelector('.homepage-recognition__logos')?.remove()
  })
}

async function movingRowGeometry(row: Locator) {
  return row.evaluate((node) => {
    const track = node.querySelector<HTMLElement>('.homepage-recognition__logo-track')!
    const cycles = Array.from(node.querySelectorAll<HTMLElement>('.homepage-recognition__logo-cycle'))
    const visibleSlots = Array.from(node.querySelectorAll<HTMLElement>('.homepage-recognition__logo'))
      .filter(slot => getComputedStyle(slot).display !== 'none')
      .map(slot => slot.getBoundingClientRect())
    const rowBox = node.getBoundingClientRect()
    const center = rowBox.left + rowBox.width / 2
    const nearestLeft = Math.min(...visibleSlots.map(slot => Math.max(slot.left - rowBox.left, rowBox.left - slot.right, 0)))
    const nearestRight = Math.min(...visibleSlots.map(slot => Math.max(slot.left - rowBox.right, rowBox.right - slot.right, 0)))
    return {
      animationName: getComputedStyle(track).animationName,
      transform: getComputedStyle(track).transform,
      cycleWidths: cycles.map(cycle => cycle.getBoundingClientRect().width),
      leftEdgeGap: nearestLeft,
      rightEdgeGap: nearestRight,
      hasLogoLeftOfCenter: visibleSlots.some(slot => slot.left + slot.width / 2 < center),
      hasLogoRightOfCenter: visibleSlots.some(slot => slot.left + slot.width / 2 > center),
    }
  })
}

function matrixTranslateX(transform: string) {
  if (transform === 'none') return 0
  return Number(transform.match(/^matrix(?:3d)?\((.+)\)$/)?.[1].split(', ')[transform.startsWith('matrix3d') ? 12 : 4] ?? 0)
}

for (const width of widths) {
  test(`homepage recognition and cloud seam remain complete at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 430 ? 900 : 1000 })
    await page.goto('/')
    await waitForBrandIntro(page)
    await mountEmptyRecognition(page)

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
      const statement = node.querySelector<HTMLElement>('.homepage-recognition__statement')!
      const style = getComputedStyle(statement)
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
    expect(recognitionStyles.backgroundColor).toMatch(/^color\(srgb |^rgb\(/)
    expect(recognitionStyles.borderTopWidth).toBe('0px')
    expect(recognitionStyles.boxShadow).toBe('none')
    expect(recognitionStyles.headingInsideSection).toBe(true)
    expect(recognitionStyles.touchesHero).toBe(true)
  })
}

for (const width of widths) {
  test(`two recognition rows remain filled, centered, and seamless at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 430 ? 900 : 1000 })
    await page.goto('/')
    await waitForBrandIntro(page)
    await mountEmptyRecognition(page)
    await mountRecognitionLogos(page, 8)

    const logoSection = page.getByTestId('homepage-recognition-logo-section')
    await logoSection.scrollIntoViewIfNeeded()
    await expect(logoSection).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(logoSection.locator('.homepage-recognition__logo-row')).toHaveCount(2)

    const forward = logoSection.locator('.homepage-recognition__logo-row--forward')
    const reverse = logoSection.locator('.homepage-recognition__logo-row--reverse')
    const initialForward = await movingRowGeometry(forward)
    const initialReverse = await movingRowGeometry(reverse)
    for (const geometry of [initialForward, initialReverse]) {
      expect(Math.abs(geometry.cycleWidths[0] - geometry.cycleWidths[1])).toBeLessThanOrEqual(1)
      expect(geometry.leftEdgeGap).toBeLessThan(96)
      expect(geometry.rightEdgeGap).toBeLessThan(96)
      expect(geometry.hasLogoLeftOfCenter).toBe(true)
      expect(geometry.hasLogoRightOfCenter).toBe(true)
    }
    expect(initialForward.animationName).toBe('recognition-logo-forward')
    expect(initialReverse.animationName).toBe('recognition-logo-reverse')

    await page.waitForTimeout(180)
    const delayedForward = await movingRowGeometry(forward)
    const delayedReverse = await movingRowGeometry(reverse)
    expect(matrixTranslateX(delayedForward.transform)).toBeLessThan(matrixTranslateX(initialForward.transform))
    expect(matrixTranslateX(delayedReverse.transform)).toBeGreaterThan(matrixTranslateX(initialReverse.transform))
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
  })
}

test('two logos move in one filled row at 1920px', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 })
  await page.goto('/')
  await waitForBrandIntro(page)
  await mountRecognitionLogos(page, 2)

  const rows = page.getByTestId('homepage-recognition-logo-section').locator('.homepage-recognition__logo-row')
  await expect(rows).toHaveCount(1)
  const geometry = await movingRowGeometry(rows.first())
  expect(geometry.leftEdgeGap).toBeLessThan(96)
  expect(geometry.rightEdgeGap).toBeLessThan(96)
  expect(geometry.hasLogoLeftOfCenter && geometry.hasLogoRightOfCenter).toBe(true)
})

test('one logo remains static, centered, and keeps its source aspect ratio', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 })
  await page.goto('/')
  await waitForBrandIntro(page)
  await mountRecognitionLogos(page, 1)

  const wall = page.getByTestId('homepage-recognition-logo-wall')
  const result = await wall.evaluate(async (node) => {
    const image = node.querySelector('img')!
    await image.decode()
    const wallBox = node.getBoundingClientRect()
    const imageBox = image.getBoundingClientRect()
    return {
      animationName: getComputedStyle(image).animationName,
      centered: Math.abs((imageBox.left + imageBox.width / 2) - (wallBox.left + wallBox.width / 2)) <= 1,
      objectFit: getComputedStyle(image).objectFit,
      aspectRatio: image.naturalWidth / image.naturalHeight,
      alt: image.alt,
    }
  })
  expect(result).toEqual({ animationName: 'none', centered: true, objectFit: 'contain', aspectRatio: 4, alt: 'Competition 1' })
})

test('reduced motion shows each original logo once without scrolling or animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await waitForBrandIntro(page)
  await mountRecognitionLogos(page, 8)

  const logoSection = page.getByTestId('homepage-recognition-logo-section')
  const result = await logoSection.evaluate((node) => {
    const tracks = Array.from(node.querySelectorAll<HTMLElement>('.homepage-recognition__logo-track'))
    const visibleImages = Array.from(node.querySelectorAll<HTMLImageElement>('.homepage-recognition__reduced-grid img'))
    return {
      reducedMotionMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationNames: tracks.map(track => getComputedStyle(track).animationName),
      transforms: tracks.map(track => getComputedStyle(track).transform),
      visibleAlts: visibleImages.map(image => image.alt).filter(Boolean),
      overflowX: getComputedStyle(node).overflowX,
      pageFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(result.reducedMotionMatches).toBe(true)
  expect(result.animationNames).toEqual(['none', 'none'])
  expect(result.transforms).toEqual(['none', 'none'])
  expect(result.visibleAlts).toEqual(Array.from({ length: 8 }, (_, index) => `Competition ${index + 1}`))
  expect(result.overflowX).toBe('hidden')
  expect(result.pageFits).toBe(true)
})
