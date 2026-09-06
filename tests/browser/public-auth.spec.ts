import { expect, test } from '@playwright/test'

test('one shared login offers password and Google without a public role picker', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/auth')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your next win.')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lanjutkan dengan Google' })).toBeVisible()
  await expect(page.getByText(/Continue as|Demo Role|Choose your workspace/i)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('registration starts with only email and can return to login', async ({ page }) => {
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Belum punya akun? Daftar' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daftar di Strativate.')
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kirim tautan email' })).toBeVisible()
  await page.getByRole('button', { name: 'Sudah punya akun? Masuk' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
})

for (const path of ['/admin', '/mentor', '/dashboard', '/onboarding', '/auth/setup', '/checkout/private-hsbc']) {
  test(`anonymous route guard rejects ${path} even with a forged demo role`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('strativate-demo-role', 'Admin'))
    await page.goto(path)
    await expect(page).toHaveURL(/\/auth$/)
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  })
}

test('invalid callback ignores arbitrary external next URLs', async ({ page }) => {
  await page.goto('/auth/callback?next=https://example.com&error=access_denied')
  await expect(page).toHaveURL(/\/auth\/error$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coba kembali.')
})

test('login and registration fit the preserved mobile auth layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/auth')
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'output/playwright/auth-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Belum punya akun? Daftar' }).click()
  await page.screenshot({ path: 'output/playwright/register-mobile.png', fullPage: true })
})
