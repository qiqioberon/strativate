import { expect, test } from '@playwright/test'

const roles = [
  { name: 'admin', url: 'http://localhost:3001/admin', fullName: 'Admin Strativate', email: 'admin@fixture.test', roleLabel: 'Admin' },
  { name: 'mentor', url: 'http://localhost:3001/mentor', fullName: 'Mentor Strativate', email: 'mentor@fixture.test', roleLabel: 'Mentor' },
  { name: 'user', url: 'http://localhost:3001/dashboard', fullName: 'User Strativate', email: 'user@fixture.test', roleLabel: 'User' },
] as const

for (const role of roles) {
  test(`${role.name} dashboard shares accessible account and notification popovers`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(role.url)

    const notificationButton = page.getByRole('button', { name: 'Buka notifikasi' })
    const accountButton = page.getByRole('button', { name: 'Buka menu akun' })
    const notificationDialog = page.getByRole('dialog', { name: 'Notifikasi' })
    const accountDialog = page.getByRole('dialog', { name: 'Informasi akun' })

    await notificationButton.click()
    await expect(notificationDialog).toBeVisible()
    await expect(notificationDialog).toContainText('Template')

    await accountButton.click()
    await expect(notificationDialog).toBeHidden()
    await expect(accountDialog).toBeVisible()
    await expect(accountDialog).toContainText(role.fullName)
    await expect(accountDialog).toContainText(role.email)
    await expect(accountDialog).toContainText(role.roleLabel)

    await page.keyboard.press('Escape')
    await expect(accountDialog).toBeHidden()

    await notificationButton.click()
    await expect(notificationDialog).toBeVisible()
    await page.locator('main').click({ position: { x: 24, y: 120 } })
    await expect(notificationDialog).toBeHidden()

    await accountButton.click()
    await accountDialog.getByRole('button', { name: 'Edit Profil' }).click()
    await expect(page.getByRole('heading', { name: 'Profil akun' })).toBeVisible()

    const homeLink = page.getByRole('link', { name: 'Kembali ke Beranda' })
    await expect(homeLink).toBeVisible()
    await expect(homeLink).toHaveAttribute('href', '/')
    await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible()
  })
}

test('user dashboard is owned-content focused and exposes honest digital product empty state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:3001/dashboard')

  await expect(page.getByText('Jelajahi program', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mentoring saya' })).toBeVisible()
  await page.getByRole('button', { name: 'Produk Digital Saya' }).click()
  await expect(page.getByRole('heading', { name: 'Belum ada produk digital.' })).toBeVisible()

  const storefrontLink = page.getByRole('link', { name: 'Lihat Produk Digital', exact: true })
  await expect(storefrontLink).toHaveAttribute('href', '/produk-digital')
})

test('shared popovers remain inside the viewport across target responsive widths', async ({ page }) => {
  const sizes = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 900 },
    { width: 375, height: 812 },
  ]

  for (const size of sizes) {
    await page.setViewportSize(size)
    await page.goto('http://localhost:3001/dashboard')
    await page.getByRole('button', { name: 'Buka notifikasi' }).click()

    const dialog = page.getByRole('dialog', { name: 'Notifikasi' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height)

    const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(fitsViewport).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  }
})
