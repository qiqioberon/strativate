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
  assert.match(manager, /DirectImageCropper/)
  assert.match(manager, /Adjust crop/)
  assert.match(manager, /aspectRatio=\{WHO_WE_ARE_PHOTO_TARGETS\[activeRole\]\.width \/ WHO_WE_ARE_PHOTO_TARGETS\[activeRole\]\.height\}/)
  assert.doesNotMatch(manager, /Horizontal position|Vertical position|Reset crop/)
  assert.match(manager, /Remove photo/)
  assert.match(manager, /selectedFile \?/)
  assert.match(manager, /<form className=\{styles\.form\} key=\{activeRole \?\? 'idle'\}/)
})

test('slot save performs safe replacement and ambiguous-write reconciliation', async () => {
  const manager = await read('components/admin/who-we-are-photo-management.tsx')
  const sourceUpload = manager.indexOf('.upload(uploadedSourcePath')
  const derivativeUpload = manager.indexOf('.upload(uploadedPath')
  const persistUpdate = manager.indexOf('.update(imagePayload)')
  const persistInsert = manager.indexOf(".insert({ role: activeRole, ...imagePayload })")
  const reconciliation = manager.indexOf("admin_list_homepage_who_we_are_photos", persistUpdate)

  assert.ok(sourceUpload >= 0 && sourceUpload < derivativeUpload)
  assert.ok(derivativeUpload >= 0 && derivativeUpload < persistUpdate)
  assert.ok(persistUpdate >= 0 && persistUpdate < reconciliation)
  assert.ok(persistInsert >= 0 && persistInsert < reconciliation)
  assert.match(manager, /if \(storedPath && storedPath !== imagePayload\.image_path\)[\s\S]*\.remove\(\[storedPath\]\)/)
  assert.match(manager, /admin_list_homepage_who_we_are_photos/)
  assert.match(manager, /persisted\?\.image_path !== uploadedPath/)
  assert.match(manager, /persisted\?\.source_image_path !== uploadedSourcePath/)
  assert.match(manager, /database status could not be confirmed/)
  assert.match(manager, /\.remove\(\[uploadedPath\]\)/)
  assert.match(manager, /\.remove\(\[uploadedSourcePath\]\)/)
})

test('metadata-only edits preserve the stored path without invoking crop or upload', async () => {
  const manager = await read('components/admin/who-we-are-photo-management.tsx')

  assert.match(manager, /if \(selectedFile\) \{[\s\S]*\.upload\(uploadedSourcePath/)
  assert.match(manager, /if \(processedFile\) \{[\s\S]*\.upload\(uploadedPath/)
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


test('slot persistence updates existing rows without resending the immutable role and inserts only for empty slots', async () => {
  const manager = await read('components/admin/who-we-are-photo-management.tsx')

  assert.doesNotMatch(manager, /\.upsert\(/)
  assert.match(manager, /selected[\s\S]*\.update\(imagePayload\)[\s\S]*\.eq\('role', activeRole\)[\s\S]*\.insert\(\{ role: activeRole, \.\.\.imagePayload \}\)/)
})


test('admin previews mirror the square supporting-photo contract', async () => {
  const css = await read('components/admin/who-we-are-photo-management.module.css')

  assert.match(css, /\.preview\.upper_right,\.preview\.lower_right\s*\{[^}]*aspect-ratio:1/)
  assert.match(css, /\.thumbnail\.upper_right,\.thumbnail\.lower_right\s*\{[^}]*width:52px;[^}]*height:52px/)
})
