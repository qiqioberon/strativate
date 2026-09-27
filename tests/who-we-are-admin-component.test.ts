import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFile(path.join(root, file), 'utf8')

test('admin navigation mounts one fixed-slot Who We Are management surface', async () => {
  const [page, manager] = await Promise.all([
    read('app/admin/page.tsx'),
    read('components/admin/who-we-are-photo-management.tsx'),
  ])

  assert.match(page, /import \{ WhoWeArePhotoManagement \}/)
  assert.match(page, /\| 'Who We Are Photos'/)
  assert.match(page, /id: 'Who We Are Photos', label: 'Who We Are Photos'/)
  assert.match(page, /section === 'Who We Are Photos' \? <WhoWeArePhotoManagement\/>/)
  assert.match(manager, /WHO_WE_ARE_PHOTO_ROLES\.map/)
  assert.match(manager, /data-testid="who-we-are-photo-admin-row"/)
  assert.match(manager, />Thumbnail</)
  assert.match(manager, />Role</)
  assert.match(manager, />Badge</)
  assert.match(manager, />Status</)
  assert.match(manager, />Manage</)
  assert.doesNotMatch(manager, /Add photo|Delete slot|Move up|Move down|reorder/i)
})

test('slot editor keeps media work inside an accessible focused dialog', async () => {
  const manager = await read('components/admin/who-we-are-photo-management.tsx')

  assert.match(manager, /<dialog/)
  assert.match(manager, /showModal\(\)/)
  assert.match(manager, /aria-labelledby="who-we-are-photo-editor-heading"/)
  assert.match(manager, /type="file"/)
  assert.match(manager, /Alt text/)
  assert.match(manager, /Badge text \(optional\)/)
  assert.match(manager, /Horizontal position/)
  assert.match(manager, /Vertical position/)
  assert.match(manager, /Zoom/)
  assert.match(manager, /Reset crop/)
  assert.match(manager, /Remove photo/)
  assert.match(manager, /selectedFile \? \(/)
  assert.match(manager, /<form className=\{styles\.form\} key=\{activeRole \?\? 'idle'\}/)
})

test('slot save performs safe replacement and ambiguous-write reconciliation', async () => {
  const manager = await read('components/admin/who-we-are-photo-management.tsx')
  const crop = manager.indexOf('cropWhoWeArePhoto(selectedFile')
  const upload = manager.indexOf('.upload(uploadedPath')
  const persist = manager.indexOf(".upsert({ role: activeRole")
  const completion = manager.indexOf('await completePersistedSave(storedPath, payload.image_path)')

  assert.ok(crop >= 0 && crop < upload)
  assert.ok(upload >= 0 && upload < persist)
  assert.ok(persist >= 0 && persist < completion)
  assert.match(manager, /if \(storedPath && storedPath !== nextPath\)[\s\S]*\.remove\(\[storedPath\]\)/)
  assert.match(manager, /\.eq\('role', activeRole\)[\s\S]*\.maybeSingle\(\)/)
  assert.match(manager, /persisted\?\.image_path === intendedPayload\.image_path/)
  assert.match(manager, /database status could not be confirmed/)
  assert.match(manager, /\.remove\(\[uploadedPath\]\)/)
  assert.match(manager, /persistAttempted/)
  assert.match(manager, /persistedMatchesPayload/)
  assert.match(manager, /select\('image_path,alt_text,badge_text'\)/)
})

test('metadata-only edits preserve the stored path without invoking crop or upload', async () => {
  const manager = await read('components/admin/who-we-are-photo-management.tsx')

  assert.match(manager, /if \(selectedFile\) \{[\s\S]*cropWhoWeArePhoto[\s\S]*\.upload\(/)
  assert.match(manager, /buildWhoWeArePhotoPayload\(\{[\s\S]*uploadedPath,[\s\S]*storedImagePath: storedPath/)
  assert.match(manager, /const storedPath = selected\?\.image_path \?\? null/)
  assert.match(manager, /aria-invalid=\{Boolean\(fieldErrors\.altText\)\}/)
  assert.match(manager, /aria-describedby=\{fieldErrors\.altText \? 'who-we-are-alt-error'/)
  assert.match(manager, /aria-invalid=\{Boolean\(fieldErrors\.file\)\}/)
})


test('crop preview establishes its own clipping containing block', async () => {
  const css = await read('components/admin/who-we-are-photo-management.module.css')

  assert.match(css, /\.preview\s*\{[^}]*position:relative[^}]*overflow:hidden/)
  assert.match(css, /\.preview img\[style\]\s*\{[^}]*object-fit:fill/)
})
