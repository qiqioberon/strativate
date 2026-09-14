import { expect, test } from '@playwright/test'

test('homepage and program overview link to editorial mentoring information without a purchase flow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Lihat Private Mentoring', exact: true })).toHaveAttribute('href', '/program/private-mentoring')
  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Program', exact: true }).click()
  await expect(page.getByText('Product Master', { exact: false })).toHaveCount(0)
  await page.locator('.marketing-service-card').filter({ hasText: 'Private Mentoring' }).getByRole('link', { name: 'Lihat Private Mentoring', exact: true }).click()
  await expect(page).toHaveURL(/\/program\/private-mentoring$/)
  await expect(page).toHaveTitle('Private Mentoring | Strativate')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://strativate.id/program/private-mentoring')
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private Mentoring')
  await page.getByRole('link', { name: 'Lihat informasi paket', exact: true }).click()
  await expect(page).toHaveURL(/#packages$/)
  await expect(page.locator('#packages')).toContainText('Rincian paket dan harga sedang diperbarui')
  await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /bayar|pesan|beli/i })).toHaveCount(0)
  await expect(page.getByText(/Rp\s?885\.000/)).toHaveCount(0)
})

test('retired Explore route redirects and the program directory opens Intensive Mentoring', async ({ page }) => {
  await page.goto('/explore')
  await expect(page).toHaveURL(/\/program$/)
  await expect(page.locator('.marketing-service-card')).toHaveCount(8)
  await page.locator('.marketing-service-card').filter({ hasText: 'Intensive Mentoring' }).getByRole('link', { name: 'Lihat Intensive Mentoring', exact: true }).click()
  await expect(page).toHaveURL(/\/program\/intensive-mentoring$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Intensive Mentoring')
  await expect(page.locator('#packages')).toContainText('Rincian paket dan harga sedang diperbarui')
  await expect(page.getByText(/Rp\s?1\.150\.000/)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Paket Jaminan Kompetisi' })).toHaveCount(0)
  await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
})

test('program overview gives the two mentoring services equal priority', async ({ page }) => {
  await page.goto('/program')

  const primary = page.getByRole('region', { name: 'Program utama' })
  await expect(primary).toHaveAttribute('data-testid', 'program-primary-services')
  await expect(primary.getByTestId(/service-card-/)).toHaveCount(2)
  await expect(primary.getByTestId('service-card-private-mentoring')).toHaveAttribute('data-variant', 'primary')
  await expect(primary.getByTestId('service-card-intensive-mentoring')).toHaveAttribute('data-variant', 'primary')
  await expect(primary.getByTestId('service-private-mentoring-link')).toHaveAttribute('href', '/program/private-mentoring')
  await expect(primary.getByTestId('service-intensive-mentoring-link')).toHaveAttribute('href', '/program/intensive-mentoring')

  const secondary = page.getByRole('region', { name: 'Gambaran Big Class' })
  await expect(secondary).toHaveAttribute('data-testid', 'program-secondary-service')
  await expect(secondary.getByTestId(/service-card-/)).toHaveCount(1)
  await expect(secondary.getByTestId('service-card-big-class')).toHaveAttribute('data-variant', 'secondary')
  await expect(secondary.getByText('Gambaran layanan')).toBeVisible()

  const supporting = page.getByRole('region', { name: 'Layanan pendukung' })
  await expect(supporting).toHaveAttribute('data-testid', 'program-supporting-services')
  await expect(supporting.getByTestId(/service-card-/)).toHaveCount(5)
  await expect(supporting.locator('[data-variant="compact"]')).toHaveCount(5)
  await expect(page.locator('.marketing-service-card')).toHaveCount(8)
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
    await expect(page.getByRole('link', { name: 'Lihat informasi paket', exact: true })).toBeVisible()
  }
})

for (const slug of ['private-mentoring', 'intensive-mentoring']) {
  test(`${slug} information and navigation remain readable on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/program/${slug}`)
    await page.getByRole('link', { name: 'Lihat informasi paket', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `output/playwright/${slug}-mobile.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}
