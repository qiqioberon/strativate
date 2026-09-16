import { expect, test } from '@playwright/test'

const preferenceCookie = 'strativate_auth_persistence'

async function openPasswordChoice(page: import('@playwright/test').Page) {
  await page.goto('/auth')
  await page.getByLabel('Email', { exact: true }).fill('mentor@example.test')
  await page.getByLabel('Kata sandi', { exact: true }).fill('test-password-2026')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  return page.getByRole('dialog', { name: 'Tetap masuk di perangkat ini?' })
}

test('password login asks for persistence before any authentication request', async ({ page }) => {
  let passwordRequests = 0
  page.on('request', request => {
    if (request.url().includes('/auth/v1/token') && request.url().includes('grant_type=password')) passwordRequests += 1
  })

  const dialog = await openPasswordChoice(page)
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Pilih “Tetap masuk” jika perangkat ini milik pribadi.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tetap masuk', exact: true })).toBeFocused()
  expect(passwordRequests).toBe(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByLabel('Email', { exact: true })).toBeEnabled()
  expect(passwordRequests).toBe(0)
  expect((await page.context().cookies()).some(cookie => cookie.name === preferenceCookie)).toBe(false)
})

for (const choice of [
  { button: 'Tetap masuk', sessionOnly: false },
  { button: 'Hanya sesi ini', sessionOnly: true },
] as const) {
  test(`${choice.button} sets the intended cookie lifetime and failed credentials clear the preference`, async ({ page, context }) => {
    let observedPreference: Awaited<ReturnType<typeof context.cookies>>[number] | undefined
    await page.route('**/auth/v1/token**', async route => {
      const origin = new URL(page.url()).origin
      const corsHeaders = {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': '*',
      }
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders })
        return
      }
      observedPreference = (await context.cookies()).find(cookie => cookie.name === preferenceCookie)
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }),
      })
    })

    const dialog = await openPasswordChoice(page)
    await dialog.getByRole('button', { name: choice.button, exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Tidak dapat masuk')

    expect(observedPreference).toBeDefined()
    if (choice.sessionOnly) expect(observedPreference!.expires).toBe(-1)
    else expect(observedPreference!.expires).toBeGreaterThan(Date.now() / 1000 + 300 * 24 * 60 * 60)
    expect((await context.cookies()).some(cookie => cookie.name === preferenceCookie)).toBe(false)
  })
}

test('Google sign-in uses the same persistence choice and cancellation does not redirect', async ({ page }) => {
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Lanjutkan dengan Google' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tetap masuk di perangkat ini?' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/auth$/)
})

test('persistence choice remains usable and contained on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  const dialog = await openPasswordChoice(page)
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tetap masuk', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Hanya sesi ini', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
