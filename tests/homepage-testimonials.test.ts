import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync(new URL('../components/marketing/home-page.tsx', import.meta.url), 'utf8')
const gallery = readFileSync(new URL('../components/marketing/testimonial-circular-gallery.tsx', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../components/admin/testimonial-management.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/marketing.css', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>
  packageManager?: string
}

test('homepage places testimonial stories between mentors and digital products with approved headline', () => {
  const mentorIndex = home.indexOf('homepage-mentors-section')
  const testimonialIndex = home.indexOf('homepage-testimonials-section')
  const productIndex = home.indexOf('homepage-products-section')
  assert.ok(mentorIndex >= 0 && testimonialIndex > mentorIndex && productIndex > testimonialIndex)
  assert.match(home, /Dari proses yang lebih terarah,/)
  assert.match(home, /lahir hasil yang mereka banggakan\./)
  assert.match(page, /listPublishedTestimonials/)
})

test('testimonial gallery continuously moves, pauses on hover, and opens details in a modal', () => {
  assert.match(gallery, /autoSpeed/)
  assert.match(gallery, /this\.paused = true/)
  assert.match(gallery, /this\.paused = false/)
  assert.match(gallery, /marketing-testimonial-gallery__overlay/)
  assert.match(gallery, /Lihat testimoni/)
  assert.match(gallery, /showModal\(\)/)
  assert.match(gallery, /prefers-reduced-motion: reduce/)
  assert.match(css, /marketing-testimonial-dialog::backdrop/)
})

test('admin testimonial manager uploads to Supabase Storage and controls publish/order state', () => {
  assert.match(admin, /TESTIMONIAL_IMAGE_BUCKET/)
  assert.match(admin, /\.upload\(uploadedPath, selectedFile/)
  assert.match(admin, /reorder_marketing_testimonials/)
  assert.match(admin, /is_published/)
  assert.match(admin, /Menunggu gambar/)
})


test('testimonial gallery keeps OGL as a runtime dependency with the CI pnpm version pinned', () => {
  assert.equal(packageJson.dependencies?.ogl, '^1.0.11')
  assert.equal(packageJson.packageManager, 'pnpm@10.17.1')
  assert.match(gallery, /const hoveredIndex = hover\?\.index \?\? null/)
  assert.match(gallery, /hoveredIndex !== null/)
})
