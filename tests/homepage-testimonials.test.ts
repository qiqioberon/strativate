import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  getTestimonialGalleryGeometry,
  getTestimonialHorizontalWheelDelta,
  resolveTestimonialPointerRelease,
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
  assert.match(gallery, /marketing-testimonial-gallery__overlay-image/)
  assert.match(gallery, /data-testimonial-popout/)
  assert.match(gallery, /rotation: -this\.plane\.rotation\.z/)
  assert.match(gallery, /'--testimonial-rotation': `\$\{hover\.rect\.rotation\}rad`/)
  assert.doesNotMatch(gallery, /marketing-testimonial-gallery__hint/)
  assert.match(gallery, /Lihat testimoni/)
  assert.match(gallery, /showModal\(\)/)
  assert.match(gallery, /centerInitialSequence\(\)/)
  assert.match(gallery, /const centerIndex = Math\.floor\(this\.medias\.length \/ 2\)/)
  assert.match(gallery, /const offset = firstMedia\.width \* centerIndex/)
  assert.match(gallery, /const inset = 2/)
  assert.match(gallery, /prefers-reduced-motion: reduce/)
  assert.match(css, /marketing-testimonial-dialog::backdrop/)
  assert.match(css, /marketing-testimonial-dialog__media[\s\S]*aspect-ratio: 5 \/ 4/)
  assert.match(css, /marketing-testimonial-dialog__media img[\s\S]*object-fit: contain/)
  assert.match(css, /marketing-testimonial-gallery__overlay[\s\S]*border-radius: 5\.5%/)
})

test('homepage cloud only masks the lower edge while the gallery stays full-width and active stories lift above it', () => {
  assert.match(css, /\.homepage-hero__gallery\s*\{[\s\S]*?z-index:\s*auto;[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none/)
  assert.match(css, /\.homepage-hero__gallery \.marketing-testimonial-gallery canvas\s*\{[\s\S]*?z-index:\s*1/)
  assert.match(css, /\.homepage-hero-cloud\s*\{[\s\S]*?z-index:\s*4/)
  assert.match(css, /\.homepage-hero-cloud\.has-gallery\s*\{[\s\S]*?margin-top:\s*12px/)
  assert.match(css, /\.homepage-hero-cloud__lobes\s*\{[\s\S]*?height:\s*clamp\(72px, 6vw, 96px\)/)
  assert.match(css, /\.homepage-hero__gallery \.marketing-testimonial-gallery__overlay\s*\{[\s\S]*?--testimonial-popout-lift:\s*-52px;[\s\S]*?z-index:\s*3;[\s\S]*?z-index 0s linear 130ms/)
  assert.match(css, /\.homepage-hero__gallery \.marketing-testimonial-gallery__overlay\.is-raised\s*\{[\s\S]*?z-index:\s*8;[\s\S]*?translateY\(var\(--testimonial-popout-lift\)\)/)
  assert.match(gallery, /data-popout-state=\{popoutRaised \? 'raised' : 'lifting'\}/)
  assert.match(gallery, /uniform float uOpacity/)
  assert.match(gallery, /gl_FragColor = vec4\(color\.rgb, color\.a \* alpha \* uOpacity\)/)
  assert.match(gallery, /setMuted\(muted: boolean\)/)
  assert.match(gallery, /this\.activeMedia = hit\.media[\s\S]*?this\.onHover\(\{ index: hit\.media\.sourceIndex, mediaIndex: hit\.media\.index, rect: hit\.rect \}\)/)
  assert.doesNotMatch(gallery, /this\.activeMedia = hit\.media\s+this\.activeMedia\.setMuted\(true\)/)
  assert.match(gallery, /muteActiveMedia\(mediaIndex: number\)[\s\S]*?this\.activeMedia\.setMuted\(true\)/)
  assert.match(gallery, /onLoad=\{\(\) => \{[\s\S]*?handlePopoutImageReady\(mediaIndex\)[\s\S]*?\}\}/)
  assert.match(gallery, /handlePopoutImageReady[\s\S]*?requestAnimationFrame[\s\S]*?requestAnimationFrame[\s\S]*?muteActiveMedia\(mediaIndex\)[\s\S]*?setPopoutRaised\(true\)/)
  assert.match(gallery, /restoreActiveMedia\(delay = 320\)/)
  assert.match(gallery, /media\.setMuted\(false\)/)
  assert.match(gallery, /window\.setTimeout\(\(\) => \{[\s\S]*?setHover\(null\)[\s\S]*?\}, 320\)/)
  assert.match(gallery, /const cardsForViewport = Math\.ceil\(this\.screen\.width \/ cardSpan\)/)
  assert.match(gallery, /const repeatCount = Math\.max\(3, Math\.ceil\(\(cardsForViewport \+ 8\) \/ this\.items\.length\)\)/)
  assert.match(gallery, /onFocus = \(\) => \{[\s\S]*?this\.showHover\(\{ media, rect: media\.getScreenRect\(\) \}\)/)
  assert.match(gallery, /keyboardRevealRequested = true/)
  assert.match(gallery, /data-testid="testimonial-active-popout"/)
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
  assert.match(gallery, /try \{[\s\S]*?setPointerCapture\?\.\(event\.pointerId\)[\s\S]*?\} catch \{/)
})

test('testimonial gallery uses mobile-specific card geometry with deliberate side previews', () => {
  assert.deepEqual(getTestimonialGalleryGeometry(390), { cardWidth: 252, cardHeight: 315, gap: 14, bend: 1.35 })
  assert.deepEqual(getTestimonialGalleryGeometry(430), { cardWidth: 278, cardHeight: 347.5, gap: 14, bend: 1.35 })
  assert.deepEqual(getTestimonialGalleryGeometry(768), { cardWidth: 220, cardHeight: 275, gap: 18, bend: 2.4 })
  const desktop = getTestimonialGalleryGeometry(1440)
  assert.equal(desktop.cardWidth, 288)
  assert.equal(desktop.cardHeight, 360)
  assert.ok(Math.abs(desktop.gap - 25.92) < Number.EPSILON * 20)
  assert.equal(desktop.bend, 2.4)
  assert.deepEqual(getTestimonialGalleryGeometry(1920), { cardWidth: 300, cardHeight: 375, gap: 28, bend: 2.4 })
})

test('testimonial touch release activates taps but never horizontal swipes or vertical page gestures', () => {
  assert.equal(resolveTestimonialPointerRelease('touch', 'pending', false), 'activate')
  assert.equal(resolveTestimonialPointerRelease('touch', 'horizontal', true), 'resume')
  assert.equal(resolveTestimonialPointerRelease('touch', 'vertical', false), 'ignore')
  assert.equal(resolveTestimonialPointerRelease('mouse', 'pending', false), 'activate')
})

test('testimonial gallery card remains 4:5 while stored/modal imagery is 5:4', () => {
  for (const viewport of [390, 430, 768, 1440, 1920]) {
    const geometry = getTestimonialGalleryGeometry(viewport)
    assert.equal(geometry.cardHeight / geometry.cardWidth, 1.25)
  }
  assert.match(gallery, /getTestimonialGalleryGeometry\(this\.screen\.width\)/)
  assert.match(css, /marketing-testimonials__heading h2[\s\S]*font-weight: 540/)
  assert.match(css, /height: clamp\(330px, 37vw, 430px\)/)
  assert.match(css, /aspect-ratio: 5 \/ 4/)
})
