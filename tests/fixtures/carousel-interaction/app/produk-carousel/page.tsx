import { DigitalProductCarousel } from '../../../../../components/marketing/digital-product-carousel'
import type { PublicDigitalProduct } from '../../../../../lib/commerce/types'

const now = '2026-09-15T00:00:00.000Z'
const products: PublicDigitalProduct[] = [
  {
    id: 'fixture-product-one',
    name: 'Produk Portrait Satu',
    slug: 'produk-portrait-satu',
    description: 'Preview produk pertama untuk regression test carousel.',
    image_path: 'assets/placeholders/cover-development.svg',
    imageUrl: '/assets/placeholders/cover-development.svg',
    price_amount: 120000,
    content_type: null,
    content_path: null,
    content_mime_type: null,
    content_file_name: null,
    content_size_bytes: null,
    page_count: null,
    duration_seconds: null,
    is_published: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'fixture-product-two',
    name: 'Produk Portrait Dua',
    slug: 'produk-portrait-dua',
    description: 'Preview produk kedua untuk regression test autoplay.',
    image_path: 'assets/placeholders/portrait-development.svg',
    imageUrl: '/assets/placeholders/portrait-development.svg',
    price_amount: 150000,
    content_type: null,
    content_path: null,
    content_mime_type: null,
    content_file_name: null,
    content_size_bytes: null,
    page_count: null,
    duration_seconds: null,
    is_published: true,
    created_at: now,
    updated_at: now,
  },
]

export default function DigitalProductCarouselFixture() {
  return <main className="marketing-site" style={{ padding: 32 }}><DigitalProductCarousel products={products} /></main>
}
