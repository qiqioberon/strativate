import { expect, test } from '@playwright/test'

test('password visibility can be toggled without submitting or losing the value', async ({ page }) => {
  await page.goto('/auth')
  const password = page.getByLabel('Kata sandi', { exact: true })
  await page.getByLabel('Email', { exact: true }).fill('mentor@example.test')
  await page.evaluate(() => {
    document.documentElement.dataset.submissions = '0'
    document.querySelector('form')!.addEventListener('submit', event => {
      event.preventDefault()
      event.stopImmediatePropagation()
      document.documentElement.dataset.submissions = '1'
    })
  })
  await password.fill('test-password-2026')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Tampilkan kata sandi', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('test-password-2026')
  await page.getByRole('button', { name: 'Sembunyikan kata sandi', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.locator('html')).toHaveAttribute('data-submissions', '0')
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0)
})

test('one shared login offers password and Google without a public role picker', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/auth')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Raih kemenangan berikutnya.')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Kata sandi', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lanjutkan dengan Google' })).toBeVisible()
  await expect(page.getByText(/Continue as|Demo Role|Choose your workspace/i)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('registration starts with only email and can return to login', async ({ page }) => {
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Belum punya akun? Daftar' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daftar di Strativate.')
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kirim tautan email' })).toBeVisible()
  await page.getByRole('button', { name: 'Sudah punya akun? Masuk' }).click()
  await expect(page.getByLabel('Kata sandi', { exact: true })).toBeVisible()
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
