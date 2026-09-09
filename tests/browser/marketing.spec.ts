import { expect, test } from '@playwright/test'

const navigation = [
  ['Beranda', '/'],
  ['Program', '/program'],
  ['Mentor', '/mentor'],
  ['Produk Digital', '/produk-digital'],
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
  await expect(page.getByRole('heading', { name: 'Mentor yang tepat, tanpa tebakan.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materi yang siap mengikuti ritmemu.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lihat Mentoring Privat' })).toHaveAttribute('href', '/program/private-mentoring')
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

  await page.goto('/mentor/dashboard')
  await expect(page).toHaveURL(/\/auth$/)
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
