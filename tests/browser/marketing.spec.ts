import { expect, test } from '@playwright/test'

const navigation = [
  ['Beranda', '/'],
  ['Program', '/program'],
  ['Mentor', '/mentor'],
  ['Tentang Kami', '/tentang-kami'],
  ['Tanya Jawab', '/tanya-jawab'],
] as const

test('homepage uses real dedicated marketing links and safe editorial previews', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' })

  for (const [label, href] of navigation) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href)
  }

  await expect(nav.getByRole('link', { name: 'Beranda', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Pilih cara belajarmu.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Belajar dari pengalaman, bertumbuh dengan arahan.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materi yang siap mengikuti ritmemu.' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Lihat Private Mentoring' })).toHaveAttribute('href', '/program/private-mentoring')
  await expect(page.locator('.marketing-program-card').filter({ hasText: 'Private Mentoring' })).toContainText('Rp300.000')
  await expect(page.getByTestId('hero-poster-carousel').or(page.getByTestId('hero-poster-fallback'))).toHaveCount(1)
  await expect(page.getByRole('img', { name: 'Strativate' }).first()).toBeVisible()
  await expect(page.getByText('2500+', { exact: true })).toBeVisible()
  await expect(page.getByText('Siswa kami berasal dari', { exact: true })).toBeVisible()
  await expect(page.getByText(/Alvin Haryanto|Universitas mitra|15\+ kemenangan|di 4 negara/)).toHaveCount(0)
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
  await page.getByTestId('faq-search-input').fill('mentor')
  await expect(page.getByTestId('faq-result-count')).toHaveText('Menampilkan 1 jawaban')
  await expect(page.getByTestId('faq-list').locator('details')).toHaveCount(1)
  const whatsapp = new URL(await page.getByTestId('global-whatsapp-cta').getAttribute('href') ?? '')
  expect(whatsapp.searchParams.get('text')).toContain('pertanyaan')
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
