import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'

import { AddToCartButton } from '@/components/digital-products/add-to-cart-button'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import { getAccount } from '@/lib/auth/server'
import { formatRupiah } from '@/lib/commerce/money'
import { getPublicDigitalProduct } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'

function purchaseMode(account: Awaited<ReturnType<typeof getAccount>>) {
  if (!account) return 'anonymous' as const
  if (
    account.profile.role === 'mentee'
    && account.mentee?.onboarding_completed_at
  ) return 'mentee' as const
  return 'unavailable' as const
}

export default async function DigitalProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isDigitalProductsEnabled()) permanentRedirect('/program')

  const { slug } = await params
  const product = await getPublicDigitalProduct(slug)
  if (!product) notFound()

  const account = await getAccount()

  return (
    <MarketingShell digitalProductsEnabled>
      <main className="digital-product-detail">
        <div className="marketing-container digital-product-detail__grid">
          <div className="digital-product-cover digital-product-cover--detail">
            {product.imageUrl ? (
              // Public product covers are marketing assets served by Supabase Storage.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={`Sampul ${product.name}`} />
            ) : (
              <div className="digital-product-cover__fallback" aria-hidden="true">Strativate</div>
            )}
          </div>

          <section className="digital-product-detail__content">
            <Link className="marketing-text-link" href="/produk-digital">
              <ArrowLeft aria-hidden="true" size={16} /> Kembali ke Produk Digital
            </Link>
            <p className="marketing-kicker">Produk Digital</p>
            <h1>{product.name}</h1>
            <p className="digital-product-detail__description">{product.description}</p>
            <div className="digital-product-detail__price">
              <span>Harga</span>
              <strong>{formatRupiah(product.price_amount)}</strong>
            </div>
            <AddToCartButton commerceItemId={product.id} purchaseMode={purchaseMode(account)} />
            <Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/cart">
              Lihat keranjang
            </Link>
          </section>
        </div>
      </main>
    </MarketingShell>
  )
}
