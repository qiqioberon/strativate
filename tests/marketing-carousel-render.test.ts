import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { HeroCarousel } from '../components/marketing/hero-carousel'
import type { MarketingHeroPosterView } from '../lib/marketing/hero-posters'

const poster = (id: string): MarketingHeroPosterView => ({
  id,
  alt_text: `Poster ${id}`,
  title: `Judul ${id}`,
  url: null,
  sort_order: 1,
  imageUrl: `/assets/placeholders/${id}.png`,
})

test('hero carousel renders honest zero, single, and multiple-poster control states', () => {
  const zero = renderToStaticMarkup(createElement(HeroCarousel, { posters: [] }))
  const single = renderToStaticMarkup(createElement(HeroCarousel, { posters: [poster('one')] }))
  const multiple = renderToStaticMarkup(createElement(HeroCarousel, { posters: [poster('one'), poster('two')] }))

  assert.match(zero, /hero-poster-fallback/)
  assert.doesNotMatch(zero, /hero-poster-previous-button/)
  assert.doesNotMatch(single, /hero-poster-previous-button/)
  assert.match(multiple, /hero-poster-previous-button/)
  assert.match(multiple, /hero-poster-next-button/)
  assert.match(multiple, /hero-poster-indicator-1/)
  assert.match(multiple, /hero-poster-indicator-2/)
})
