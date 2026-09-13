'use client'

import { HeroCarousel } from '../../../../components/marketing/hero-carousel'
import type { MarketingHeroPosterView } from '../../../../lib/marketing/hero-posters'

const posters: MarketingHeroPosterView[] = [
  { id: 'fixture-one', alt_text: 'Poster satu', title: 'Poster satu', url: null, sort_order: 1, imageUrl: '/assets/placeholders/fixture-one.png' },
  { id: 'fixture-two', alt_text: 'Poster dua', title: 'Poster dua', url: null, sort_order: 2, imageUrl: '/assets/placeholders/fixture-two.png' },
  { id: 'fixture-three', alt_text: 'Poster tiga', title: 'Poster tiga', url: null, sort_order: 3, imageUrl: '/assets/placeholders/fixture-three.png' },
]

export default function CarouselInteractionFixture() {
  return <main className="marketing-site"><HeroCarousel posters={posters} /></main>
}
