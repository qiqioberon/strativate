import { expect, test } from '@playwright/test'

test('homepage and program overview link to guidebook information without a demo purchase', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Jelajahi Mentoring Privat', exact: true })).toHaveAttribute('href', '/program/private-mentoring')
  await page.locator('.main-nav').getByRole('button', { name: 'Program', exact: true }).click()
  await expect(page.getByText('Demo flow:', { exact: false })).toHaveCount(0)
  await page.getByRole('link', { name: 'Lihat Mentoring Privat', exact: true }).click()
  await expect(page).toHaveURL(/\/program\/private-mentoring$/)
  await page.getByRole('link', { name: 'Lihat paket', exact: true }).click()
  await expect(page).toHaveURL(/#packages$/)
  const student = page.getByRole('table', { name: 'Paket Mentor Mahasiswa Berprestasi' })
  const threeSessions = student.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '3 sesi', exact: true }) })
  await expect(threeSessions).toContainText('Rp285.000')
  await expect(threeSessions).toContainText('Rp855.000')
  await expect(student).not.toContainText('Rp885.000')
  await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /bayar|pesan|beli/i })).toHaveCount(0)
})

test('Explore filters the two mentoring programs and opens intensive packages', async ({ page }) => {
  await page.goto('/explore')
  await page.getByRole('button', { name: 'Mentoring Intensif', exact: true }).click()
  await expect(page.locator('.catalog-card')).toHaveCount(1)
  await page.getByRole('link', { name: 'Lihat program' }).click()
  await expect(page).toHaveURL(/\/program\/intensive-mentoring$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mentoring Intensif')
  await expect(page.locator('#packages')).toContainText('Rp1.150.000')
  await expect(page.locator('#packages')).toContainText('Rp2.200.000')
  await expect(page.locator('#packages')).toContainText('4 sesi per bulan')
  await expect(page.locator('#packages')).toContainText('8 sesi per bulan')
  await expect(page.locator('#add-ons')).toContainText('Syarat, ketentuan, dan penilaian kelayakan berlaku')
  await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
})

test('old mentoring URLs and direct checkout entries lead to public program information', async ({ page }) => {
  for (const [path, destination] of [
    ['/program/brandstorm-coaching', 'private-mentoring'],
    ['/program/interview-intensive', 'intensive-mentoring'],
    ['/checkout/portfolio-direction', 'private-mentoring'],
    ['/checkout/private-mentoring', 'private-mentoring'],
    ['/checkout/business-case-intensive', 'intensive-mentoring'],
    ['/checkout/intensive-mentoring', 'intensive-mentoring'],
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`/program/${destination}$`))
    await expect(page.getByRole('link', { name: 'Lihat paket', exact: true })).toBeVisible()
  }
})

for (const slug of ['private-mentoring', 'intensive-mentoring']) {
  test(`${slug} pricing and navigation remain readable on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/program/${slug}`)
    await page.getByRole('link', { name: 'Lihat paket', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `output/playwright/${slug}-mobile.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}
