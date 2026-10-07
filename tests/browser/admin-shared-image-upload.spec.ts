import { expect, test, type Page } from '@playwright/test'

async function backend(page: Page) {
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

async function openAdminSection(page: Page, section: string) {
  if (section === 'Who We Are Photos') {
    await page.getByRole('button', { name: 'About Us Content', exact: true }).click()
    await page.getByRole('tab', { name: 'Who We Are Photos', exact: true }).click()
    return
  }
  await page.getByRole('button', { name: section, exact: true }).click()
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
  { section: 'Competition Recognition', add: 'Add Recognition', width: 1000, height: 800 },
  { section: 'Trusted Partners', add: 'Add Partner', width: 800, height: 640 },
  { section: 'Who We Are Photos', slot: 0, width: 1200, height: 1600 },
  { section: 'Who We Are Photos', slot: 1, width: 1000, height: 1000 },
  { section: 'Who We Are Photos', slot: 2, width: 1000, height: 1000 },
]

for (const item of cases) {
  test(`${item.section} ${item.slot ?? ''} shares crop, preview, adjust and cancel at ${item.width}x${item.height}`, async ({ page }) => {
    await backend(page)
    await page.goto('http://localhost:3001/admin')
    await openAdminSection(page, item.section)
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
    // Wait for showModal/source decoding, not just a dialog in the DOM.
    await expect(cropper.getByLabel('Movable crop selection')).toBeVisible()
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

for (const feature of [
  { section: 'Trusted Partners', table: 'trusted_partners', prefix: 'partner-logos', sourcePrefix: 'trusted-partners', nameField: 'organization_name', nameLabel: 'Organization / Partner name', add: 'Add Partner', submit: 'Add partner', editor: 'trusted-partner-editor-dialog', close: 'Close partner editor', width: 800, height: 640 },
  { section: 'Competition Recognition', table: 'competition_recognitions', prefix: 'recognition-logos', sourcePrefix: 'competition-recognitions', nameField: 'competition_name', nameLabel: 'Competition name', add: 'Add Recognition', submit: 'Add recognition', editor: 'competition-recognition-editor-dialog', close: 'Close recognition editor', width: 1000, height: 800 },
]) {
test(`${feature.section} creates a record with private source and normalized crop`, async ({ page }) => {
  await backend(page)
  let saved: Record<string, unknown> | null = null
  const events: string[] = []
  await page.route(`**/rest/v1/${feature.table}*`, async route => {
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON()
      events.push('persist')
    }
    await route.fulfill({ status: 204 })
  })
  await page.route('**/storage/v1/object/**', async route => {
    events.push(new URL(route.request().url()).pathname)
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.goto('http://localhost:3001/admin')
  await openAdminSection(page, feature.section)
  await page.getByRole('button', { name: feature.add, exact: true }).click()
  const editor = page.getByTestId(feature.editor)
  await editor.getByLabel(feature.nameLabel, { exact: true }).fill('Synthetic creation fixture')
  await editor.locator('input[type=file]').setInputFiles(await png(page))
  await page.locator('.direct-crop-dialog[open]').getByRole('button', { name: 'Apply crop', exact: true }).click()
  await editor.getByRole('button', { name: feature.submit, exact: true }).click()
  await expect(editor).toBeHidden()
  expect(saved).toEqual(expect.objectContaining({
    [feature.nameField]: 'Synthetic creation fixture',
    logo_path: expect.stringMatching(new RegExp(`^${feature.prefix}/.+\\.webp$`)),
    logo_source_path: expect.stringMatching(new RegExp(`^${feature.sourcePrefix}/.+\\.png$`)),
    logo_crop: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) }),
  }))
  expect(events).toEqual([
    expect.stringContaining(`marketing-photo-sources/${feature.sourcePrefix}/`),
    expect.stringContaining(`marketing-editorial/${feature.prefix}/`),
    'persist',
  ])
})

test(`${feature.section} legacy replacement saves 5:4, adjusts from the same private original, and deletes both objects`, async ({ page }) => {
  await backend(page)
  await page.goto('http://localhost:3001/admin')
  const source = await png(page)
  const oldPath = `${feature.prefix}/legacy.webp`
  let row = { id: 'c7000000-0000-4000-8000-000000000010', [feature.nameField]: 'Approved fixture', logo_path: oldPath,
    logo_source_path: null as string | null, logo_crop: null as unknown, display_order: 0, is_active: true,
    created_at: '2026-10-07T00:00:00Z', updated_at: '2026-10-07T00:00:00Z' }
  let deleted = false
  const events: string[] = []
  const derivatives: { width: number; height: number; type: string }[] = []
  await page.route(`**/rest/v1/rpc/admin_list_${feature.table}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(deleted ? [] : [row]) }))
  await page.route(`**/rest/v1/${feature.table}*`, async route => {
    const method = route.request().method()
    events.push(method)
    if (method === 'PATCH') row = { ...row, ...route.request().postDataJSON() }
    if (method === 'DELETE') deleted = true
    await route.fulfill({ status: 204 })
  })
  await page.route('**/storage/v1/object/**', async route => {
    const method = route.request().method()
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: source.buffer })
    if (method === 'POST' && route.request().url().includes('marketing-editorial')) {
      const encoded = route.request().postDataBuffer()!.toString('base64')
      const contentType = route.request().headers()['content-type']
      derivatives.push(await page.evaluate(async ({ base64, contentType }) => {
        const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
        const response = new Response(bytes, { headers: { 'content-type': contentType } })
        // Supabase sends browser File uploads as multipart, not raw WebP bytes.
        const form = await response.formData()
        const file = Array.from(form.values()).find(value => value instanceof File) as File
        const bitmap = await createImageBitmap(file)
        const dimensions = { width: bitmap.width, height: bitmap.height, type: file.type }
        bitmap.close()
        return dimensions
      }, { base64: encoded, contentType }))
    }
    events.push(`${method}:${new URL(route.request().url()).pathname}`)
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await openAdminSection(page, feature.section)
  await page.getByRole('button', { name: 'Manage', exact: true }).click()
  const editor = page.getByTestId(feature.editor)
  await expect(editor.getByText(/Original source is unavailable/)).toBeVisible()
  await expect(editor.getByRole('button', { name: 'Adjust crop', exact: true })).toBeDisabled()
  await editor.locator('input[type=file]').setInputFiles(source)
  await page.locator('.direct-crop-dialog[open]').getByRole('button', { name: 'Apply crop', exact: true }).click()
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor).toBeHidden()
  expect(row.logo_source_path).toMatch(new RegExp(`^${feature.sourcePrefix}/.+\\.png$`))
  expect(row.logo_path).toMatch(new RegExp(`^${feature.prefix}/.+\\.webp$`))
  expect(row.logo_crop).toEqual(expect.objectContaining({ x: expect.any(Number), width: expect.any(Number) }))
  expect(events.slice(0, 4)).toEqual([
    expect.stringContaining(`POST:/storage/v1/object/marketing-photo-sources/${feature.sourcePrefix}/`),
    expect.stringContaining(`POST:/storage/v1/object/marketing-editorial/${feature.prefix}/`),
    'PATCH', 'DELETE:/storage/v1/object/marketing-editorial',
  ])
  await page.getByRole('button', { name: 'Manage', exact: true }).click()
  await editor.getByRole('button', { name: 'Adjust crop', exact: true }).click()
  await expect(page.locator('.direct-crop-dialog[open]').getByLabel('Movable crop selection')).toBeVisible()
  const sourcePath = row.logo_source_path
  const derivativePath = row.logo_path
  await page.locator('.direct-crop-dialog[open]').getByRole('button', { name: 'Apply crop', exact: true }).click()
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor).toBeHidden()
  expect(row.logo_source_path).toBe(sourcePath)
  expect(row.logo_path).not.toBe(derivativePath)
  expect(events.filter(event => event.startsWith('POST:/storage/v1/object/marketing-photo-sources'))).toHaveLength(1)
  expect(derivatives).toEqual(Array.from({ length: 2 }, () => ({ width: feature.width, height: feature.height, type: 'image/webp' })))
  await page.getByRole('button', { name: 'Manage', exact: true }).click()
  await editor.getByRole('button', { name: feature.close, exact: true }).click()
  await page.getByRole('button', { name: 'Delete Approved fixture' }).click()
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Delete Approved fixture' })).toHaveCount(0)
  expect(events.slice(-3)).toEqual(['DELETE', 'DELETE:/storage/v1/object/marketing-editorial', 'DELETE:/storage/v1/object/marketing-photo-sources'])
})
}

test('Who We Are removal clears image metadata before cleaning both stored files', async ({ page }) => {
  await backend(page)
  const row = { role: 'primary', image_path: 'who-we-are/primary/fixture.webp', source_image_path: 'who-we-are/primary/fixture.png',
    image_crop: { x: 0, y: 0, width: 1, height: 1 }, alt_text: 'Synthetic photo', badge_text: 'Synthetic badge',
    created_at: '2026-10-07T00:00:00Z', updated_at: '2026-10-07T00:00:00Z' }
  const events: string[] = []
  let payload: Record<string, unknown> | null = null
  await page.route('**/rest/v1/rpc/admin_list_homepage_who_we_are_photos', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) }))
  await page.route('**/rest/v1/homepage_who_we_are_photos*', async route => {
    payload = route.request().postDataJSON()
    events.push(route.request().method())
    await route.fulfill({ status: 204 })
  })
  await page.route('**/storage/v1/object/**', async route => {
    if (route.request().method() === 'DELETE') events.push(`DELETE:${new URL(route.request().url()).pathname}`)
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.goto('http://localhost:3001/admin')
  await openAdminSection(page, 'Who We Are Photos')
  await page.getByRole('button', { name: 'Manage', exact: true }).first().click()
  const editor = page.getByTestId('who-we-are-photo-editor-dialog')
  await editor.getByRole('button', { name: 'Remove photo', exact: true }).click()
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editor).toBeHidden()
  expect(payload).toEqual(expect.objectContaining({ image_path: null, source_image_path: null, image_crop: null, alt_text: null, badge_text: null }))
  expect(events).toEqual(['PATCH', 'DELETE:/storage/v1/object/marketing-editorial', 'DELETE:/storage/v1/object/marketing-photo-sources'])
})

test('Who We Are keeps the 8 MB limit and shared validation accepts JPEG and WebP', async ({ page }) => {
  await backend(page)
  await page.goto('http://localhost:3001/admin')
  await openAdminSection(page, 'Who We Are Photos')
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
