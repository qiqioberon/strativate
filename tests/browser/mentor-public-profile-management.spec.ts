import { expect, test, type Page, type Route } from '@playwright/test'

const viewports = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const

async function openMentorProfile(page: Page) {
  await page.goto('http://localhost:3001/mentor')
  const mobileMenu = page.getByRole('button', { name: 'Buka menu mentor' })
  if (await mobileMenu.isVisible()) await mobileMenu.click()
  await page.getByRole('button', { name: 'Profil' }).click()
  await expect(page.getByTestId('mentor-public-profile-card')).toBeVisible()
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
}

test('mentor public profile edit surface stays inside every required viewport', async ({ page }) => {
  const longHeadline = 'Strategic Business Case and Finance Mentor '.repeat(7)
  const longUrl = `https://www.linkedin.com/in/${'mentor-public-profile-'.repeat(12)}`
  const longAchievement = 'National and international competition achievement with detailed factual context '.repeat(8)

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await openMentorProfile(page)
    await page.getByTestId('mentor-public-profile-edit-button').click()
    const form = page.getByTestId('mentor-public-profile-edit-form')
    await expect(form).toBeVisible()

    await form.getByLabel('Headline profesional').fill(longHeadline)
    await form.getByLabel('LinkedIn').fill(longUrl)
    await form.getByLabel('Achievement 1').fill(longAchievement)

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const [cardBox, formBox] = await Promise.all([
      page.getByTestId('mentor-public-profile-card').boundingBox(),
      form.boundingBox(),
    ])
    expect(cardBox).not.toBeNull()
    expect(formBox).not.toBeNull()
    expect(cardBox!.x).toBeGreaterThanOrEqual(0)
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(formBox!.x).toBeGreaterThanOrEqual(cardBox!.x - 1)
    expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1)
  }
})

test('mentor public profile save keeps the returned RPC state instead of snapping back to initial props', async ({ page }) => {
  await page.route('**/rest/v1/rpc/save_my_mentor_public_profile', route => fulfillJson(route, {
    profile: {
      id: '96000000-0000-0000-0000-000000000001',
      public_slug: 'mentor-strativate',
      display_name: 'Mentor Saved State',
      tier_id: '81000000-0000-0000-0000-000000000001',
      tier_name: 'Top Student',
      headline: 'Saved headline',
      linkedin_url: 'https://www.linkedin.com/in/mentor-saved-state/',
      short_bio: 'Saved short bio.',
      portrait_asset_key: 'mentors.navira-putri.portrait',
      portrait_url: null,
      photo_status: 'ready',
      publication_status: 'draft',
      sort_order: 10,
    },
    achievements: [{ id: '97000000-0000-0000-0000-000000000003', achievement: 'Saved achievement', sort_order: 10 }],
    expertise_ids: ['82000000-0000-0000-0000-000000000003'],
    expertise_options: [
      { id: '82000000-0000-0000-0000-000000000003', name: 'Business Case', slug: 'business-case', sort_order: 30, is_active: true, assigned: true },
    ],
  }))

  await page.setViewportSize({ width: 390, height: 844 })
  await openMentorProfile(page)
  await page.getByTestId('mentor-public-profile-edit-button').click()
  await page.getByLabel('Nama publik').fill('Mentor Saved State')
  await page.getByLabel('Headline profesional').fill('Saved headline')
  await page.getByTestId('mentor-public-profile-save-button').click()

  await expect(page.getByRole('status')).toContainText('Profil publik berhasil disimpan')
  const readonly = page.getByTestId('mentor-public-profile-readonly')
  await expect(readonly).toContainText('Mentor Saved State')
  await expect(readonly).toContainText('Saved headline')
  await expect(readonly).not.toContainText('Business Case Mentor')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('public mentor DTO renders expertise and achievements without private account fields', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/public-mentor')

  await expect(page.getByTestId('mentor-directory-grid').locator('.marketing-mentor-card')).toHaveCount(2)
  await expect(page.getByText('mentor@fixture.test')).toHaveCount(0)
  await expect(page.getByText('Asia/Jakarta')).toHaveCount(0)
  await expect(page.getByText('Draft Mentor')).toHaveCount(0)

  await page.getByTestId('mentor-search-input').fill('Published Mentor')
  await page.getByRole('button', { name: 'View full profile for Published Mentor', exact: true }).click()
  const dialog = page.getByTestId('mentor-detail-modal')
  await expect(dialog).toHaveAttribute('open', '')
  await expect(dialog.getByTestId('mentor-modal-expertise-section')).toContainText('Business Case')
  await expect(dialog.getByTestId('mentor-modal-credentials-section')).toContainText('National Business Case Winner')
  await expect(dialog).toContainText('Bio publik yang aman ditampilkan dari DTO direktori.')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
