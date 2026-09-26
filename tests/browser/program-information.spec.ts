import { expect, test } from '@playwright/test'

test('static Private Mentoring marketing and DB catalog coexist without self-service scheduling', async ({ page }) => {
  await page.goto('/')
  const homeCard = page.getByTestId('program-card-private-mentoring-link')
  await expect(homeCard).toContainText('Get personalized guidance tailored to your goals')
  await expect(homeCard).toHaveAttribute('href', '/program/private-mentoring')

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Programs', exact: true }).click()
  const directoryCard = page.locator('.marketing-service-card').filter({ hasText: 'Private Mentoring' })
  await expect(directoryCard).toContainText('Get personalized guidance tailored to your goals')
  await directoryCard.getByRole('link', { name: 'View Private Mentoring', exact: true }).click()

  await expect(page).toHaveURL(/\/program\/private-mentoring$/)
  await expect(page).toHaveTitle('Private Mentoring | Strativate')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://strativate.id/program/private-mentoring')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private Mentoring')
  await expect(page.getByTestId('program-detail-hero')).toContainText('Start with one focused session')
  await expect(page.getByTestId('program-detail-hero')).toContainText('Choose your focus')
  await expect(page.getByText('Initial consultation', { exact: true })).toBeVisible()

  await expect(page.getByTestId('private-mentoring-learning-paths')).toContainText('End-to-End Learning')
  await expect(page.getByTestId('private-mentoring-learning-paths')).toContainText('Competition-Focused Mentoring')
  await expect(page.getByTestId('private-mentoring-session-focuses')).toContainText('Idea & Problem Framing')
  await expect(page.getByTestId('private-mentoring-session-focuses')).toContainText('Pitching & Presentation Skills')
  await expect(page.getByText('Business Plan Competition', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'View packages', exact: true }).click()
  await expect(page).toHaveURL(/#packages$/)
  await expect(page.locator('#packages')).toContainText('Top Student')
  await expect(page.locator('#packages')).toContainText('Young Professional')
  await expect(page.getByTestId('private-mentoring-package-top_student-3')).toContainText('Rp885.000')
  await expect(page.getByTestId('private-mentoring-package-top_student-3')).toContainText('Rp295.000/session')
  await expect(page.locator('#packages')).toContainText('75 minutes/session')
  await expect(page.locator('#packages')).toContainText('max. 4 participants')
  await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /choose mentor|schedule|pay|order|buy/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Ask about packages on WhatsApp/i })).toBeVisible()
})

test('retired Explore route redirects and the program directory opens Intensive Mentoring', async ({ page }) => {
  await page.goto('/explore')
  await expect(page).toHaveURL(/\/program$/)
  await expect(page.locator('.marketing-service-card')).toHaveCount(8)
  await page.locator('.marketing-service-card').filter({ hasText: 'Intensive Mentoring' }).getByRole('link', { name: 'View Intensive Mentoring', exact: true }).click()
  await expect(page).toHaveURL(/\/program\/intensive-mentoring$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Intensive Mentoring')
  await expect(page.getByTestId('program-packages-section')).toContainText(/Package information is not available right now|Packages and pricing/)
  await expect(page.locator('a[href*="/checkout/"]')).toHaveCount(0)
})

test('program overview keeps the current stakeholder service hierarchy and mentoring paths', async ({ page }) => {
  await page.goto('/program')
  await expect(page.getByTestId('program-directory-section')).toBeVisible()
  const primary = page.getByRole('region', { name: 'Core programs' })
  await expect(primary).toHaveAttribute('data-testid', 'program-primary-services')
  await expect(primary.getByTestId(/service-card-/)).toHaveCount(2)
  await expect(primary.getByTestId('service-card-private-mentoring')).toHaveAttribute('data-variant', 'primary')
  await expect(primary.getByTestId('service-card-intensive-mentoring')).toHaveAttribute('data-variant', 'primary')
  await expect(primary.getByTestId('service-private-mentoring-link')).toHaveAttribute('href', '/program/private-mentoring')
  await expect(primary.getByTestId('service-intensive-mentoring-link')).toHaveAttribute('href', '/program/intensive-mentoring')
  const secondary = page.getByRole('region', { name: 'Big Class overview' })
  await expect(secondary).toHaveAttribute('data-testid', 'program-secondary-service')
  await expect(secondary.getByTestId(/service-card-/)).toHaveCount(1)
  await expect(secondary.getByTestId('service-card-big-class')).toHaveAttribute('data-variant', 'secondary')
  const supporting = page.getByRole('region', { name: 'Supporting services' })
  await expect(supporting.getByTestId(/service-card-/)).toHaveCount(5)
  await expect(page.locator('.marketing-service-card')).toHaveCount(8)
  await expect(page.getByTestId('program-mentoring-path-section')).toBeVisible()
  await expect(page.getByTestId('program-perfect-fit-section')).toBeVisible()
  await expect(page.getByTestId('program-organizations-section')).toBeVisible()
  await expect(page.getByTestId('program-final-cta-section')).toBeVisible()
})

test('old mentoring URLs and direct checkout entries lead to public program information', async ({ page }) => {
  for (const [path, destination] of [
    ['/program/brandstorm-coaching', 'private-mentoring'], ['/program/interview-intensive', 'intensive-mentoring'], ['/checkout/portfolio-direction', 'private-mentoring'], ['/checkout/private-mentoring', 'private-mentoring'], ['/checkout/business-case-intensive', 'intensive-mentoring'], ['/checkout/intensive-mentoring', 'intensive-mentoring'],
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`/program/${destination}$`))
    await expect(page.getByRole('link', { name: 'View packages', exact: true })).toBeVisible()
  }
})

for (const slug of ['private-mentoring', 'intensive-mentoring']) {
  test(`${slug} information and navigation remain readable on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/program/${slug}`)
    await page.getByRole('link', { name: 'View packages', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `output/playwright/${slug}-mobile.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}
