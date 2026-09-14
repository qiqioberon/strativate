import { expect, test } from '@playwright/test'

test('static Private Mentoring marketing and DB catalog coexist without self-service scheduling', async ({ page }) => {
  await page.goto('/')
  const homeCard = page.getByTestId('program-card-private-mentoring-link')
  await expect(homeCard).toContainText('Mentoring fleksibel untuk individu atau tim kecil')
  await expect(homeCard).toHaveAttribute('href', '/program/private-mentoring')

  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Program', exact: true }).click()
  await expect(page.getByText('Product Master', { exact: false })).toHaveCount(0)
  const directoryCard = page.locator('.marketing-service-card').filter({ hasText: 'Private Mentoring' })
  await expect(directoryCard).toContainText('Mentoring fleksibel untuk individu atau tim kecil')
  await directoryCard.getByRole('link', { name: 'Lihat Private Mentoring', exact: true }).click()

  await expect(page).toHaveURL(/\/program\/private-mentoring$/)
  await expect(page).toHaveTitle('Private Mentoring | Strativate')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://strativate.id/program/private-mentoring')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private Mentoring')
  await expect(page.getByTestId('program-detail-hero')).toContainText('Mulai dengan satu sesi terarah')
  await expect(page.getByTestId('program-detail-hero')).toContainText('Belajar bersama mentor pilihan')
  await expect(page.getByText('Konsultasi awal', { exact: true })).toBeVisible()

  await expect(page.getByTestId('private-mentoring-learning-paths')).toContainText('End-to-End Learning')
  await expect(page.getByTestId('private-mentoring-learning-paths')).toContainText('Competition-Focused Mentoring')
  await expect(page.getByTestId('private-mentoring-session-focuses')).toContainText('Idea & Problem Framing')
  await expect(page.getByTestId('private-mentoring-session-focuses')).toContainText('Pitching & Presentation Skills')
  await expect(page.getByText('Business Plan Competition', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Lihat informasi paket', exact: true }).click()
  await expect(page).toHaveURL(/#packages$/)
  await expect(page.locator('#packages')).toContainText('Top Student')
  await expect(page.locator('#packages')).toContainText('Young Professional')
  await expect(page.getByTestId('private-mentoring-package-top_student-3')).toContainText('Rp885.000')
  await expect(page.getByTestId('private-mentoring-package-top_student-3')).toContainText('Rp295.000/session')
  await expect(page.locator('#packages')).toContainText('75 menit/sesi')
  await expect(page.locator('#packages')).toContainText('maks. 4 peserta')
  await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /pilih mentor|jadwalkan|bayar|pesan|beli/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Konsultasi via WhatsApp/i })).toBeVisible()
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

test('program overview keeps the pre-Phase-3 service hierarchy and journey presentation', async ({ page }) => {
  await page.goto('/program')
  await expect(page.getByTestId('program-directory-section')).toBeVisible()
  await expect(page.getByText('Tiga langkah untuk menemukan format yang pas.', { exact: true })).toBeVisible()
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
  const supporting = page.getByRole('region', { name: 'Layanan pendukung' })
  await expect(supporting.getByTestId(/service-card-/)).toHaveCount(5)
  await expect(page.locator('.marketing-service-card')).toHaveCount(8)
  await expect(page.getByTestId('program-consultation-section')).toBeVisible()
})

test('old mentoring URLs and direct checkout entries lead to public program information', async ({ page }) => {
  for (const [path, destination] of [
    ['/program/brandstorm-coaching', 'private-mentoring'], ['/program/interview-intensive', 'intensive-mentoring'], ['/checkout/portfolio-direction', 'private-mentoring'], ['/checkout/private-mentoring', 'private-mentoring'], ['/checkout/business-case-intensive', 'intensive-mentoring'], ['/checkout/intensive-mentoring', 'intensive-mentoring'],
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
