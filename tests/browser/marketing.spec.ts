import { expect, test } from '@playwright/test'

const navigation = [
  ['Beranda', '/'],
  ['Program', '/program'],
  ['Mentor', '/mentor'],
  ['Tentang Kami', '/tentang-kami'],
  ['Tanya Jawab', '/tanya-jawab'],
] as const

test('homepage uses the approved centered mentoring opening and cloud proof', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Win Business Competitions with Expert Mentoring' })).toBeVisible()
  await expect(page.getByText('Transform your ideas into winning strategies. Get personalized guidance from experienced mentors and achieve podium finishes.', { exact: true })).toBeVisible()
  await expect(page.getByTestId('hero-whatsapp-link')).toHaveText(/Consultation/)
  await expect(page.getByTestId('hero-poster-carousel')).toHaveCount(0)
  await expect(page.getByTestId('hero-poster-fallback')).toHaveCount(0)
  await expect(page.getByTestId('hero-shape-grid')).toBeVisible()

  const socialProof = page.getByTestId('homepage-social-proof')
  await expect(socialProof.locator('article')).toHaveCount(3)
  await expect(socialProof.getByText('2,500+', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('Students supported', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('15+', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('Universities', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('20+', { exact: true })).toBeVisible()
  await expect(socialProof.getByText('High schools', { exact: true })).toBeVisible()

  await expect(page.getByTestId('homepage-hero-cloud').locator('.homepage-hero-cloud__lobes span')).toHaveCount(7)
  await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
  await expect(page.getByText(/Alvin Haryanto|Universitas mitra|15\+ kemenangan|di 4 negara/)).toHaveCount(0)
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})

test('homepage mentor marquee provides one accessible directory sequence and motion-safe fallback', async ({ page }) => {
  await page.goto('/')

  const marquee = page.getByTestId('mentor-infinite-marquee')
  await expect(marquee.locator('.marketing-mentor-marquee__group')).toHaveCount(2)
  await expect(marquee.locator('.marketing-mentor-marquee__group[aria-hidden="true"] a')).toHaveCount(26)
  await expect(marquee.locator('.marketing-mentor-marquee__group[aria-hidden="true"] a').first()).toHaveAttribute('tabindex', '-1')
  await expect(marquee.locator('.marketing-mentor-marquee__group:not([aria-hidden]) a')).toHaveCount(26)
  await expect(marquee.locator('.marketing-mentor-marquee__card').first()).toHaveAttribute('href', /^\/mentor#mentor-/)
  await expect(marquee.locator('.marketing-mentor-marquee__track')).toHaveCSS('animation-duration', '140s')
  await marquee.hover()
  await expect(marquee.locator('.marketing-mentor-marquee__track')).toHaveCSS('animation-play-state', 'paused')
  await marquee.locator('.marketing-mentor-marquee__card').first().focus()
  await expect(marquee.locator('.marketing-mentor-marquee__track')).toHaveCSS('animation-play-state', 'paused')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(marquee.locator('.marketing-mentor-marquee__track')).toHaveCSS('animation-name', 'none')
  await expect(marquee.locator('.marketing-mentor-marquee__group[aria-hidden="true"]')).toBeHidden()
  await expect(marquee).toHaveCSS('overflow-x', 'auto')
})

test('carousel fixture wires manual controls, swipe lifecycle, and scheduling reset', async ({ page }) => {
  await page.clock.install()
  await page.goto('http://localhost:3001')
  const carousel = page.getByTestId('hero-poster-carousel')
  const title = page.getByTestId('hero-poster-title')
  await expect(carousel).toHaveCSS('touch-action', 'pan-y pinch-zoom')
  await expect(title).toHaveText('Poster satu')

  await page.clock.fastForward(3000)
  await page.getByTestId('hero-poster-next-button').click()
  await expect(title).toHaveText('Poster dua')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.mouse.move(1200, 700)
  await page.clock.fastForward(2500)
  await expect(title).toHaveText('Poster dua')
  await page.clock.fastForward(3000)
  await expect(title).toHaveText('Poster tiga')

  await page.getByTestId('hero-poster-previous-button').click()
  await expect(title).toHaveText('Poster dua')
  await page.getByTestId('hero-poster-indicator-3').click()
  await expect(title).toHaveText('Poster tiga')
  await carousel.press('ArrowLeft')
  await expect(title).toHaveText('Poster dua')
  await carousel.press('ArrowRight')
  await expect(title).toHaveText('Poster tiga')

  await carousel.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: 260 })
  await carousel.dispatchEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 7, clientX: 120 })
  await expect(title).toHaveText('Poster satu')

  await carousel.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 8, clientX: 260 })
  await carousel.dispatchEvent('pointercancel', { bubbles: true, pointerType: 'touch', pointerId: 8 })
  await expect(title).toHaveText('Poster satu')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.mouse.move(1200, 700)
  await page.waitForTimeout(50)
  await page.clock.fastForward(5100)
  await expect(title).toHaveText('Poster dua')

  const box = await carousel.boundingBox()
  if (!box) throw new Error('Expected carousel bounds')
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(1, 1)
  await page.mouse.up()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.clock.fastForward(5100)
  await expect(title).toHaveText('Poster tiga')
})

test('carousel disables autoplay when reduced motion is requested', async ({ page }) => {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://localhost:3001')
  const title = page.getByTestId('hero-poster-title')

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.mouse.move(1200, 700)
  await expect(title).toHaveText('Poster satu')
  await page.clock.fastForward(10000)
  await expect(title).toHaveText('Poster satu')
})

for (const [label, href] of navigation.slice(1)) {
  test(`${label} has a dedicated public route and active navigation state`, async ({ page }) => {
    await page.goto(href)
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page')
  })
}

test('public mentor directory and protected mentor workspace remain distinct', async ({ page }) => {
  await page.goto('/mentor')
  await expect(page).toHaveURL(/\/mentor$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('mentor')
  await expect(page.locator('.marketing-mentor-card')).toHaveCount(26)
  await expect(page.getByText('Menampilkan 26 mentor')).toBeVisible()
  await page.getByPlaceholder('Cari nama atau keahlian').fill('Navira Putri')
  await expect(page.locator('.marketing-mentor-card')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Navira Putri' })).toBeVisible()
  await page.getByTestId('mentor-navira-putri-detail-button').click()
  await expect(page.getByTestId('mentor-detail-modal')).toHaveAttribute('open', '')
  await expect(page.getByTestId('mentor-modal-name')).toHaveText('Navira Putri')
  await page.getByTestId('mentor-modal-close-button').click()
  await expect(page.getByTestId('mentor-detail-modal')).not.toHaveAttribute('open', '')

  await page.goto('/mentor/dashboard')
  await expect(page).toHaveURL(/\/auth$/)
})

test('mentor directory filters, resets, and opens an accessible centered profile dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 520 })
  await page.goto('/mentor')

  const directory = page.getByTestId('mentor-directory-grid')
  await expect(directory.locator('.marketing-mentor-card')).toHaveCount(26)
  await expect(page.getByTestId('mentor-result-count')).toHaveText('Menampilkan 26 mentor')
  await expect(page.getByTestId('mentor-reset-button')).toHaveCount(0)
  await expect(page.getByTestId('mentor-card-navira-putri')).toHaveAttribute('id', 'mentor-navira-putri')
  await expect(page.getByRole('button', { name: 'Lihat profil lengkap Navira Putri' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'LinkedIn Navira Putri' })).toBeVisible()

  await page.getByTestId('mentor-tier-top-student-button').click()
  await page.getByTestId('mentor-search-input').fill('Alvaro Zhafran')
  await expect(directory.locator('.marketing-mentor-card')).toHaveCount(1)
  await expect(page.getByTestId('mentor-result-count')).toHaveText('Menampilkan 1 mentor')
  await expect(page.getByTestId('mentor-reset-button')).toBeVisible()

  await page.getByTestId('mentor-reset-button').click()
  await expect(directory.locator('.marketing-mentor-card')).toHaveCount(26)
  await expect(page.getByTestId('mentor-result-count')).toHaveText('Menampilkan 26 mentor')
  await expect(page.getByTestId('mentor-reset-button')).toHaveCount(0)

  await page.getByRole('button', { name: 'Lihat profil lengkap Navira Putri' }).click()
  const dialog = page.getByTestId('mentor-detail-modal')
  await expect(dialog).toHaveAttribute('open', '')
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThanOrEqual(2)
  expect(Math.abs(box!.y + box!.height / 2 - 260)).toBeLessThanOrEqual(2)
  await expect(dialog).toHaveCSS('overflow-y', 'auto')
  const scrollBounds = await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop }
  })
  expect(scrollBounds.scrollHeight).toBeGreaterThan(scrollBounds.clientHeight)
  expect(scrollBounds.scrollTop).toBe(scrollBounds.scrollHeight - scrollBounds.clientHeight)
  await expect(dialog.locator('[data-testid="mentor-modal-expertise-section"] svg')).toHaveCount(1)
  await expect(dialog.locator('[data-testid="mentor-modal-credentials-section"] svg')).toHaveCount(1)
  await expect(dialog.getByTestId('mentor-modal-linkedin-link')).toHaveAttribute('href', /linkedin\.com/)
  await expect(dialog.getByTestId('mentor-modal-whatsapp-link')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).not.toHaveAttribute('open', '')
  await page.getByRole('button', { name: 'Lihat profil lengkap Navira Putri' }).click()
  await page.getByTestId('mentor-modal-close-button').click()
  await expect(dialog).not.toHaveAttribute('open', '')
})

test('mentor dialog is single-column, scrollable, and overflow-safe on mobile with a missing photo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/mentor')
  await page.getByTestId('mentor-search-input').fill('Ivonne Qiu')
  await page.getByRole('button', { name: 'Lihat profil lengkap Ivonne Qiu' }).click()

  const dialog = page.getByTestId('mentor-detail-modal')
  await expect(dialog).toHaveAttribute('open', '')
  const mobileColumns = await dialog.locator('.marketing-mentor-dialog__panel').evaluate((panel) => getComputedStyle(panel).gridTemplateColumns)
  expect(mobileColumns.trim().split(/\s+/)).toHaveLength(1)
  await expect(dialog.locator('.asset-media')).toContainText('Foto belum tersedia')
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)

  await page.mouse.click(8, 8)
  await expect(dialog).not.toHaveAttribute('open', '')
})

test('program directory hides digital products and retired digital route redirects', async ({ page }) => {
  await page.goto('/program')
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
  await expect(page.locator('.marketing-service-card')).toHaveCount(8)
  await expect(page.getByRole('heading', { name: 'Private Mentoring' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Community' })).toBeVisible()
  await expect(page.getByText('Kelas Besar Kasus Bisnis')).toHaveCount(0)

  await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Produk Digital' })).toHaveCount(0)
  await page.goto('/produk-digital')
  await expect(page).toHaveURL(/\/program$/)
  await expect(page.getByTestId('program-directory-section')).toBeVisible()
})

test('FAQ search and contextual WhatsApp consultation remain usable', async ({ page }) => {
  await page.goto('/tanya-jawab')
  await page.getByTestId('faq-search-input').fill('LinkedIn')
  await expect(page.getByTestId('faq-result-count')).toHaveText('Menampilkan 1 jawaban')
  await expect(page.getByTestId('faq-list').locator('details')).toHaveCount(1)
  const whatsapp = new URL(await page.getByTestId('global-whatsapp-cta').getAttribute('href') ?? '')
  expect(whatsapp.searchParams.get('text')).toContain('pertanyaan')
})

test('editorial page intros use their dedicated motifs and exact WhatsApp consultation messages', async ({ page }) => {
  const intros = [
    ['/program', 'program', 'program-page-intro-whatsapp-link', 'Halo Strativate, saya ingin konsultasi untuk memilih program Strativate yang sesuai.'],
    ['/mentor', 'mentor', 'mentor-page-intro-whatsapp-link', 'Halo Strativate, saya ingin konsultasi untuk memilih mentor yang sesuai dengan kebutuhan saya.'],
    ['/tentang-kami', 'about', 'about-page-intro-whatsapp-link', 'Halo Strativate, saya ingin mengetahui lebih lanjut tentang layanan dan pendekatan Strativate.'],
    ['/tanya-jawab', 'faq', 'faq-page-intro-whatsapp-link', 'Halo Strativate, saya masih memiliki pertanyaan tentang layanan Strativate. Bisa dibantu?'],
  ] as const

  for (const [route, motifName, linkTestId, message] of intros) {
    await page.goto(route)
    await expect(page.getByTestId('marketing-page-intro-motif')).toHaveAttribute('data-motif', motifName)
    const href = new URL(await page.getByTestId(linkTestId).getAttribute('href') ?? '')
    expect(href.searchParams.get('text')).toBe(message)
  }
})

test('editorial page intros keep their title and description inside every required viewport', async ({ page }) => {
  const intros = [
    ['/program', 'Pilih dukungan'],
    ['/mentor', 'Belajar bersama mentor'],
    ['/tentang-kami', 'Ambisi bertemu'],
    ['/tanya-jawab', 'Mulai dari informasi'],
  ] as const
  const viewports = [
    { width: 1440, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ] as const

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const [route, readableTitle] of intros) {
      await page.goto(route)
      const title = page.getByTestId('marketing-page-title')
      const description = page.getByTestId('marketing-page-description')
      const [titleBox, descriptionBox] = await Promise.all([title.boundingBox(), description.boundingBox()])

      expect(titleBox).not.toBeNull()
      expect(descriptionBox).not.toBeNull()
      expect(titleBox!.x).toBeGreaterThanOrEqual(0)
      expect(descriptionBox!.x).toBeGreaterThanOrEqual(0)
      expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(viewport.width)
      expect(descriptionBox!.x + descriptionBox!.width).toBeLessThanOrEqual(viewport.width)
      await expect(title).toContainText(readableTitle)
    }
  }

  await page.setViewportSize({ width: 360, height: 844 })
  await page.goto('/mentor')
  const [mentorTitle, mentorDescription] = await Promise.all([
    page.getByTestId('marketing-page-title').boundingBox(),
    page.getByTestId('marketing-page-description').boundingBox(),
  ])
  expect(mentorTitle).not.toBeNull()
  expect(mentorDescription).not.toBeNull()
  expect(mentorTitle!.x + mentorTitle!.width).toBeLessThanOrEqual(360)
  expect(mentorDescription!.x + mentorDescription!.width).toBeLessThanOrEqual(360)
  await expect(page.getByTestId('marketing-page-title')).toContainText('Belajar bersama mentor')
})

test('mobile menu is accessible, navigates natively, and avoids overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const toggle = page.locator('button[aria-controls="marketing-mobile-navigation"]')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')

  const mobileNav = page.getByRole('navigation', { name: 'Navigasi seluler' })
  await expect(mobileNav.getByRole('link', { name: 'Program', exact: true })).toBeVisible()
  await mobileNav.getByRole('link', { name: 'Program', exact: true }).click()
  await expect(page).toHaveURL(/\/program$/)
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
})

test('desktop header keeps navigation centered between left brand and right actions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const [brandBox, navBox, actionsBox] = await Promise.all([
    page.getByRole('banner').locator('.marketing-brand').boundingBox(),
    page.getByRole('navigation', { name: 'Navigasi utama' }).boundingBox(),
    page.locator('.marketing-header__actions').boundingBox(),
  ])

  expect(brandBox).not.toBeNull()
  expect(navBox).not.toBeNull()
  expect(actionsBox).not.toBeNull()
  expect(Math.abs(navBox!.x + navBox!.width / 2 - 720)).toBeLessThanOrEqual(2)
  expect(brandBox!.x + brandBox!.width).toBeLessThan(navBox!.x)
  expect(actionsBox!.x).toBeGreaterThan(navBox!.x + navBox!.width)
})

test('page intro motif is decorative and absent from the accessibility tree', async ({ page }) => {
  await page.goto('/program')

  const motif = page.getByTestId('marketing-page-intro-motif')
  await expect(motif).toHaveAttribute('aria-hidden', 'true')
  await expect(motif).toHaveAttribute('data-motif', 'program')
  await expect(page.getByRole('img', { name: /program/i })).toHaveCount(0)
})

test('marketing footer spans the viewport and stacks its content rows', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const footer = page.getByRole('contentinfo')
    const footerBox = await footer.boundingBox()
    const gridBox = await footer.locator('.marketing-footer__grid').boundingBox()
    const bottomBox = await footer.locator('.marketing-footer__bottom').boundingBox()

    expect(footerBox).not.toBeNull()
    expect(gridBox).not.toBeNull()
    expect(bottomBox).not.toBeNull()
    expect(footerBox!.x).toBe(0)
    expect(footerBox!.width).toBe(viewport.width)
    expect(bottomBox!.y).toBeGreaterThanOrEqual(gridBox!.y + gridBox!.height)
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
  }
})
