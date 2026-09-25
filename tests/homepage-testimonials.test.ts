import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  getTestimonialHorizontalWheelDelta,
  resolveTestimonialDragIntent,
} from '../lib/marketing/testimonial-gallery-input'

const home = readFileSync(new URL('../components/marketing/home-page.tsx', import.meta.url), 'utf8')
const gallery = readFileSync(new URL('../components/marketing/testimonial-circular-gallery.tsx', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../components/admin/testimonial-management.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/marketing.css', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>
  packageManager?: string
}

test('homepage places the success-story gallery inside the hero before the approved content sequence', () => {
  const heroIndex = home.indexOf('homepage-hero-section')
  const proofIndex = home.indexOf('homepage-success-proof-section')
  const whoIndex = home.indexOf('homepage-who-we-are-section')
  const programIndex = home.indexOf('homepage-programs-section')
  const productIndex = home.indexOf('homepage-products-section')
  const expertiseIndex = home.indexOf('homepage-expertise-section')
  const mentorIndex = home.indexOf('homepage-mentors-section')
  assert.ok(heroIndex >= 0 && proofIndex > heroIndex && whoIndex > proofIndex && programIndex > whoIndex && productIndex > programIndex && expertiseIndex > productIndex && mentorIndex > expertiseIndex)
  assert.match(home, /TestimonialCircularGallery/)
  assert.doesNotMatch(home, /A clearer process\.|Stronger competition outcomes\.|homepage-testimonials-section/)
  assert.match(page, /listPublishedTestimonials/)
})

test('testimonial gallery continuously moves, pauses on hover, and opens details in a modal', () => {
  assert.match(gallery, /autoSpeed/)
  assert.match(gallery, /this\.paused = true/)
  assert.match(gallery, /this\.paused = false/)
  assert.match(gallery, /marketing-testimonial-gallery__overlay/)
  assert.match(gallery, /rotation: -this\.plane\.rotation\.z/)
  assert.match(gallery, /rotate\(\$\{hover\.rect\.rotation\}rad\)/)
  assert.doesNotMatch(gallery, /marketing-testimonial-gallery__hint/)
  assert.match(gallery, /Lihat testimoni/)
  assert.match(gallery, /showModal\(\)/)
  assert.match(gallery, /centerInitialSequence\(\)/)
  assert.match(gallery, /const offset = firstMedia\.width \* this\.items\.length/)
  assert.match(gallery, /const inset = 2/)
  assert.match(gallery, /prefers-reduced-motion: reduce/)
  assert.match(css, /marketing-testimonial-dialog::backdrop/)
  assert.match(css, /marketing-testimonial-dialog__media[\s\S]*aspect-ratio: 5 \/ 4/)
  assert.match(css, /marketing-testimonial-dialog__media img[\s\S]*object-fit: contain/)
  assert.match(css, /marketing-testimonial-gallery__overlay[\s\S]*border-radius: 5\.5%/)
})

test('admin testimonial manager uploads to Supabase Storage and controls publish/order state', () => {
  assert.match(admin, /TESTIMONIAL_IMAGE_BUCKET/)
  assert.match(admin, /cropTestimonialImage\(selectedFile, crop\)/)
  assert.match(admin, /File baru otomatis disimpan dalam format 5:4/)
  assert.match(admin, /TESTIMONIAL_IMAGE_WIDTH} × {TESTIMONIAL_IMAGE_HEIGHT} px · 5:4/)
  assert.match(admin, /contentType: 'image\/webp'/)
  assert.match(admin, /testimonial-crop-controls/)
  assert.doesNotMatch(admin, /Label peserta \/ tim/)
  assert.doesNotMatch(admin, /Alt text gambar/)
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


test('testimonial gallery only consumes horizontal wheel and horizontal drag intent', () => {
  assert.equal(getTestimonialHorizontalWheelDelta(0, 120), 0)
  assert.equal(getTestimonialHorizontalWheelDelta(18, 80), 0)
  assert.equal(getTestimonialHorizontalWheelDelta(42, 8), 42)
  assert.equal(resolveTestimonialDragIntent(4, 5), 'pending')
  assert.equal(resolveTestimonialDragIntent(12, 60), 'vertical')
  assert.equal(resolveTestimonialDragIntent(60, 12), 'horizontal')
  assert.match(gallery, /getTestimonialHorizontalWheelDelta\(event\.deltaX, event\.deltaY\)/)
  assert.match(gallery, /resolveTestimonialDragIntent\(deltaX, deltaY\)/)
})

test('testimonial gallery card remains 4:5 while stored/modal imagery is 5:4', () => {
  assert.match(gallery, /cardHeight = cardWidth \* 1\.25/)
  assert.match(gallery, /Math\.min\(300, this\.screen\.width \* \.2\)/)
  assert.match(css, /marketing-testimonials__heading h2[\s\S]*font-weight: 540/)
  assert.match(css, /height: clamp\(330px, 37vw, 430px\)/)
  assert.match(css, /aspect-ratio: 5 \/ 4/)
})
