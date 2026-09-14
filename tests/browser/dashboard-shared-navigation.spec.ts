import { expect, test } from '@playwright/test'

const roles = [
  { name: 'admin', url: 'http://localhost:3001/admin', fullName: 'Admin Strativate', email: 'admin@fixture.test', roleLabel: 'Admin' },
  { name: 'mentor', url: 'http://localhost:3001/mentor', fullName: 'Mentor Strativate', email: 'mentor@fixture.test', roleLabel: 'Mentor' },
  { name: 'user', url: 'http://localhost:3001/dashboard', fullName: 'User Strativate', email: 'user@fixture.test', roleLabel: 'User' },
] as const

function isKnownFixtureAssetFailure(url: string) {
  const parsed = new URL(url)
  if (parsed.pathname.startsWith('/assets/brand/')) return true
  if (parsed.pathname === '/_next/image') return decodeURIComponent(parsed.search).includes('/assets/brand/')
  return false
}

function captureRuntimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  const httpErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400 && !isKnownFixtureAssetFailure(response.url())) {
      httpErrors.push(`${response.status()} ${response.url()}`)
    }
  })
  return { errors, httpErrors }
}

for (const role of roles) {
  test(`${role.name} dashboard shares accessible account and notification popovers`, async ({ page }) => {
    const runtime = captureRuntimeErrors(page)
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
    expect(runtime.errors).toEqual([])
    expect(runtime.httpErrors).toEqual([])
  })
}

test('user dashboard is owned-content focused and exposes honest digital product empty state', async ({ page }) => {
  const runtime = captureRuntimeErrors(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:3001/dashboard')

  await expect(page.getByText('Jelajahi program', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mentoring saya' })).toBeVisible()
  await page.getByRole('button', { name: 'Produk Digital Saya' }).click()
  await expect(page.getByRole('heading', { name: 'Anda belum memiliki Produk Digital.' })).toBeVisible()

  const storefrontLink = page.getByRole('link', { name: 'Lihat Produk Digital', exact: true })
  await expect(storefrontLink).toHaveAttribute('href', '/produk-digital')
  expect(runtime.errors).toEqual([])
  expect(runtime.httpErrors).toEqual([])
})

test('all role popovers remain inside the viewport across target responsive widths', async ({ page }) => {
  const sizes = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 900 },
    { width: 375, height: 812 },
  ]

  for (const role of roles) {
    for (const size of sizes) {
      await page.setViewportSize(size)
      await page.goto(role.url)
      await page.getByRole('button', { name: 'Buka notifikasi' }).click()

      const dialog = page.getByRole('dialog', { name: 'Notifikasi' })
      await expect(dialog).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x, `${role.name} ${size.width}x${size.height} popover left edge`).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, `${role.name} ${size.width}x${size.height} popover right edge`).toBeLessThanOrEqual(size.width)
      expect(box!.y, `${role.name} ${size.width}x${size.height} popover top edge`).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height, `${role.name} ${size.width}x${size.height} popover bottom edge`).toBeLessThanOrEqual(size.height)

      const viewport = await page.evaluate(() => {
        const innerWidth = window.innerWidth
        const rects = Array.from(document.querySelectorAll<HTMLElement>('body *')).map(element => {
          const rect = element.getBoundingClientRect()
          const parent = element.parentElement
          return {
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === 'string' ? element.className : '',
            parentClass: parent && typeof parent.className === 'string' ? parent.className : '',
            text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100) || '',
            left: rect.left,
            right: rect.right,
            width: rect.width,
          }
        })
        const rightOverflow = rects
          .filter(rect => rect.right > innerWidth + 0.1)
          .sort((a, b) => b.right - a.right)
          .slice(0, 8)
        const leftOverflow = rects
          .filter(rect => rect.left < -0.1)
          .sort((a, b) => a.left - b.left)
          .slice(0, 3)
        return {
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          innerWidth,
          rightOverflow,
          leftOverflow,
        }
      })
      expect(
        viewport.scrollWidth,
        `${role.name} ${size.width}x${size.height} document overflow: ${viewport.scrollWidth}px > ${viewport.innerWidth}px; body=${viewport.bodyScrollWidth}px; right=${JSON.stringify(viewport.rightOverflow)}; left=${JSON.stringify(viewport.leftOverflow)}`,
      ).toBeLessThanOrEqual(viewport.innerWidth)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
    }
  }
})
