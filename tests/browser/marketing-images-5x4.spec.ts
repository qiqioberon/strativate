import { expect, test } from '@playwright/test'

for (const { width, columns, recognitionWidth, galleryWidth, cardWidth, staticCardWidth } of [
  { width: 390, columns: 2, recognitionWidth: 78, galleryWidth: 358, cardWidth: 173, staticCardWidth: 173 },
  { width: 768, columns: 3, recognitionWidth: 92, galleryWidth: 728, cardWidth: 225.653, staticCardWidth: 230.667 },
  { width: 1440, columns: 4, recognitionWidth: 100.8, galleryWidth: 1160, cardWidth: 263, staticCardWidth: 276.5 },
]) {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`5:4 public frames preserve horizontal geometry at ${width}px (${reducedMotion})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ reducedMotion })
      await page.goto('http://localhost:3001/marketing-images')
      const geometry = await page.evaluate(() => {
        const visible = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector))
          .filter(element => element.getBoundingClientRect().width > 1 && getComputedStyle(element).display !== 'none')
        const recognition = visible('.homepage-recognition__logo').find(element => element.getBoundingClientRect().height > 0)!
        const gallery = document.querySelector<HTMLElement>('.homepage-partners__gallery')!
        const layout = visible('.homepage-partners__wall').find(element => getComputedStyle(element).display === 'grid')
          ?? document.querySelector<HTMLElement>('.homepage-partners__static-grid')!
        const card = layout.querySelector<HTMLElement>('.homepage-partners__card')!
        const image = card.querySelector<HTMLImageElement>('img')!
        const imageBox = image.getBoundingClientRect()
        const cardBox = card.getBoundingClientRect()
        const grid = getComputedStyle(layout)
        const track = layout.querySelector<HTMLElement>('.homepage-partners__track')
        return {
          recognition: { width: recognition.getBoundingClientRect().width, height: recognition.getBoundingClientRect().height },
          galleryWidth: gallery.getBoundingClientRect().width,
          layoutWidth: layout.getBoundingClientRect().width,
          columnWidths: grid.gridTemplateColumns.split(' ').map(parseFloat),
          gap: parseFloat(grid.columnGap), padding: parseFloat(grid.paddingLeft) + parseFloat(grid.paddingRight),
          cardWidth: cardBox.width, imageWidth: imageBox.width, imageHeight: imageBox.height,
          imageFits: imageBox.top >= cardBox.top && imageBox.bottom <= cardBox.bottom,
          trackAnimation: track ? getComputedStyle(track).animationName : null,
          partnerAnimations: Array.from(layout.querySelectorAll<HTMLElement>('.homepage-partners__track')).map(element => getComputedStyle(element).animationName),
          recognitionAnimations: visible('.homepage-recognition__logo-track').map(element => getComputedStyle(element).animationName),
          sourceExposed: document.body.innerHTML.includes('marketing-photo-sources'),
        }
      })
      expect(geometry.recognition.width).toBeCloseTo(recognitionWidth, 1)
      expect(geometry.recognition.width / geometry.recognition.height).toBeCloseTo(1.25, 2)
      expect(geometry.galleryWidth).toBeCloseTo(galleryWidth, 1)
      expect(geometry.columnWidths).toHaveLength(columns)
      expect(geometry.cardWidth).toBeCloseTo((geometry.layoutWidth - geometry.padding - geometry.gap * (columns - 1)) / columns, 1)
      expect(geometry.cardWidth).toBeCloseTo(reducedMotion === 'reduce' ? staticCardWidth : cardWidth, 1)
      expect(geometry.imageWidth).toBeLessThanOrEqual(184)
      expect(geometry.imageWidth / geometry.imageHeight).toBeCloseTo(1.25, 2)
      expect(geometry.imageFits).toBe(true)
      expect(geometry.sourceExposed).toBe(false)
      if (reducedMotion === 'reduce') {
        expect(geometry.trackAnimation).toBe(null)
      } else {
        expect(geometry.trackAnimation).toBe('homepage-partners-scroll-down')
        expect(geometry.partnerAnimations).toEqual(Array.from({ length: columns }, (_, index) => index % 2 ? 'homepage-partners-scroll-up' : 'homepage-partners-scroll-down'))
        expect(geometry.recognitionAnimations).toEqual(['recognition-logo-forward', 'recognition-logo-reverse'])
      }
    })
  }
}
