import { expect, test, type Page } from '@playwright/test'

async function backend(page: Page) {
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

async function png(page: Page, width = 2000, height = 1800) {
  const base64 = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    // Transparent corners deliberately survive cropping and WebP conversion.
    const context = canvas.getContext('2d')!
    context.fillStyle = '#de6b31'
    context.fillRect(width / 4, height / 4, width / 2, height / 2)
    return canvas.toDataURL('image/png').split(',')[1]
  }, { width, height })
  return { name: 'source.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

const cases = [
  { section: 'Publications', add: 'Add publication', width: 1600, height: 900 },
  { section: 'Competitions', add: 'Add competition', width: 1600, height: 900 },
  { section: 'Competition Recognition', add: 'Add Recognition', width: 1000, height: 400 },
  { section: 'Trusted Partners', add: 'Add Partner', width: 800, height: 400 },
  { section: 'Who We Are Photos', slot: 0, width: 1200, height: 1600 },
  { section: 'Who We Are Photos', slot: 1, width: 1000, height: 1000 },
  { section: 'Who We Are Photos', slot: 2, width: 1000, height: 1000 },
]

for (const item of cases) {
  test(`${item.section} ${item.slot ?? ''} shares crop, preview, adjust and cancel at ${item.width}x${item.height}`, async ({ page }) => {
    await backend(page)
    await page.goto('http://localhost:3001/admin')
    await page.getByRole('button', { name: item.section, exact: true }).click()
    if (item.add) await page.getByRole('button', { name: item.add, exact: true }).first().click()
    else await page.getByRole('button', { name: 'Manage', exact: true }).nth(item.slot!).click()
    const editor = page.locator('dialog[open]').first()
    const input = editor.locator('input[type=file]').first()
    await input.setInputFiles(await png(page))
    const cropper = page.locator('.direct-crop-dialog[open]')
    await expect(cropper.getByLabel('Movable crop selection')).toBeVisible()
    await expect(cropper.locator('.direct-crop-handle')).toHaveCount(4)
    const handle = await cropper.locator('.direct-crop-handle--se').boundingBox()
    await page.mouse.move(handle!.x + 3, handle!.y + 3)
    await page.mouse.down()
    await page.mouse.move(handle!.x - 50, handle!.y - 50, { steps: 5 })
    await page.mouse.up()
    const selection = cropper.getByLabel('Movable crop selection')
    const bounds = await selection.boundingBox()
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
    await page.mouse.down()
    await page.mouse.move(bounds!.x + bounds!.width / 2 + 12, bounds!.y + bounds!.height / 2 + 12)
    await page.mouse.up()
    await cropper.getByRole('button', { name: 'Reset', exact: true }).click()
    await cropper.getByRole('button', { name: 'Apply crop', exact: true }).click()
    await expect(cropper).toBeHidden()
    const preview = editor.locator('.editorial-cover-preview img')
    await expect(preview).toBeVisible()
    const output = await preview.evaluate(async element => {
      const image = element as HTMLImageElement
      await image.decode()
      const blob = await (await fetch(image.src)).blob()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return { width: image.naturalWidth, height: image.naturalHeight, type: blob.type, alpha: context.getImageData(0, 0, 1, 1).data[3] }
    })
    expect(output).toEqual({ width: item.width, height: item.height, type: 'image/webp', alpha: 0 })
    const priorUrl = await preview.getAttribute('src')
    await editor.getByRole('button', { name: 'Adjust crop', exact: true }).click()
    await expect(cropper).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(cropper).toBeHidden()
    await expect(editor).toBeVisible()
    await expect(preview).toHaveAttribute('src', priorUrl!)
    await input.setInputFiles(await png(page, 120, 100))
    await expect(cropper.getByText('Selected crop may look blurry at the final size.')).toBeVisible()
    await cropper.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(preview).toHaveAttribute('src', priorUrl!)
  })
}

test('shared logo field rejects unsupported and oversized files and leaves the editor open', async ({ page }) => {
  await backend(page)
  await page.goto('http://localhost:3001/admin')
  await page.getByRole('button', { name: 'Competition Recognition', exact: true }).click()
  await page.getByRole('button', { name: 'Add Recognition', exact: true }).click()
  const input = page.locator('dialog[open] input[type=file]')
  await input.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(page.getByText('Use a JPG, PNG, or WebP image.')).toBeVisible()
  await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })
  await expect(page.getByText('Image must be 5 MB or smaller.')).toBeVisible()
  await expect(page.locator('.direct-crop-dialog[open]')).toHaveCount(0)
})

test('legacy logo replacement persists private original and crop, permits reopening, and deletes both objects', async ({ page }) => {
  await backend(page)
  await page.goto('http://localhost:3001/admin')
  const source = await png(page)
  const oldPath = 'partner-logos/legacy.webp'
  let row = { id: 'c7000000-0000-4000-8000-000000000010', organization_name: 'Approved fixture', logo_path: oldPath,
    logo_source_path: null as string | null, logo_crop: null as unknown, display_order: 0, is_active: true,
    created_at: '2026-10-07T00:00:00Z', updated_at: '2026-10-07T00:00:00Z' }
  let deleted = false
  const events: string[] = []
  await page.route('**/rest/v1/rpc/admin_list_trusted_partners', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(deleted ? [] : [row]) }))
  await page.route('**/rest/v1/trusted_partners*', async route => {
    const method = route.request().method()
    events.push(method)
    if (method === 'PATCH') row = { ...row, ...route.request().postDataJSON() }
    if (method === 'DELETE') deleted = true
    await route.fulfill({ status: 204 })
  })
  await page.route('**/storage/v1/object/**', async route => {
    const method = route.request().method()
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: source.buffer })
    events.push(`${method}:${new URL(route.request().url()).pathname}`)
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.getByRole('button', { name: 'Trusted Partners', exact: true }).click()
  await page.getByRole('button', { name: 'Manage', exact: true }).click()
  const editor = page.getByTestId('trusted-partner-editor-dialog')
  await expect(editor.getByText(/Original source is unavailable/)).toBeVisible()
  await expect(editor.getByRole('button', { name: 'Adjust crop', exact: true })).toBeDisabled()
  await editor.locator('input[type=file]').setInputFiles(source)
  await page.locator('.direct-crop-dialog[open]').getByRole('button', { name: 'Apply crop', exact: true }).click()
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor).toBeHidden()
  expect(row.logo_source_path).toMatch(/^trusted-partners\/.+\.png$/)
  expect(row.logo_path).toMatch(/^partner-logos\/.+\.webp$/)
  expect(row.logo_crop).toEqual(expect.objectContaining({ x: expect.any(Number), width: expect.any(Number) }))
  expect(events.slice(0, 4)).toEqual([
    expect.stringContaining('POST:/storage/v1/object/marketing-photo-sources/trusted-partners/'),
    expect.stringContaining('POST:/storage/v1/object/marketing-editorial/partner-logos/'),
    'PATCH', 'DELETE:/storage/v1/object/marketing-editorial',
  ])
  await page.getByRole('button', { name: 'Manage', exact: true }).click()
  await editor.getByRole('button', { name: 'Adjust crop', exact: true }).click()
  await expect(page.locator('.direct-crop-dialog[open]').getByLabel('Movable crop selection')).toBeVisible()
  await page.locator('.direct-crop-dialog[open]').getByRole('button', { name: 'Cancel', exact: true }).click()
  await editor.getByRole('button', { name: 'Close partner editor', exact: true }).click()
  await page.getByRole('button', { name: 'Delete Approved fixture' }).click()
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(page.getByTestId('trusted-partner-admin-row')).toHaveCount(0)
  expect(events.slice(-3)).toEqual(['DELETE', 'DELETE:/storage/v1/object/marketing-editorial', 'DELETE:/storage/v1/object/marketing-photo-sources'])
})

test('Who We Are keeps the 8 MB limit and shared validation accepts JPEG and WebP', async ({ page }) => {
  await backend(page)
  await page.goto('http://localhost:3001/admin')
  await page.getByRole('button', { name: 'Who We Are Photos', exact: true }).click()
  await page.getByRole('button', { name: 'Manage', exact: true }).first().click()
  const input = page.locator('dialog[open] input[type=file]')
  await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(8 * 1024 * 1024 + 1) })
  await expect(page.getByText('Image must be 8 MB or smaller.')).toBeVisible()
  for (const type of ['image/jpeg', 'image/webp']) {
    const base64 = await page.evaluate(type => {
      const canvas = document.createElement('canvas')
      canvas.width = 120
      canvas.height = 100
      return canvas.toDataURL(type).split(',')[1]
    }, type)
    await input.setInputFiles({ name: type === 'image/jpeg' ? 'photo.jpg' : 'photo.webp', mimeType: type, buffer: Buffer.from(base64, 'base64') })
    const cropper = page.locator('.direct-crop-dialog[open]')
    await expect(cropper.getByLabel('Movable crop selection')).toBeVisible()
    await cropper.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
})
