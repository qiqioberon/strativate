import { ArrowLeft, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'

import { AddToCartButton } from '@/components/digital-products/add-to-cart-button'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import { getAccount } from '@/lib/auth/server'
import { formatRupiah } from '@/lib/commerce/money'
import { resolveDigitalPurchaseMode } from '@/lib/commerce/purchase-mode'
import { getPublicDigitalProduct } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'

export default async function DigitalProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isDigitalProductsEnabled()) permanentRedirect('/program')

  const { slug } = await params
  const [product, account] = await Promise.all([
    getPublicDigitalProduct(slug),
    getAccount(),
  ])
  if (!product) notFound()

  const purchaseMode = resolveDigitalPurchaseMode(account)

  return (
    <MarketingShell digitalProductsEnabled>
      <main className="digital-product-detail">
        <div className="marketing-container digital-product-detail__grid">
          <div className="digital-product-detail__media">
            <div className="digital-product-cover digital-product-cover--detail">
              {product.imageUrl ? (
                // Public product covers are marketing assets served by Supabase Storage.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt={`Cover of ${product.name}`} />
              ) : (
                <div className="digital-product-cover__fallback" aria-hidden="true">Strativate</div>
              )}
            </div>
          </div>

          <section className="digital-product-detail__content">
            <Link className="marketing-text-link digital-product-detail__back" href="/produk-digital">
              <ArrowLeft aria-hidden="true" size={16} /> Back to Digital Products
            </Link>
            <div className="digital-product-detail__copy">
              <p className="marketing-kicker">Digital Product</p>
              <h1>{product.name}</h1>
              <p className="digital-product-detail__description">{product.description}</p>
            </div>
            <div className="digital-product-detail__purchase">
              <div className="digital-product-detail__price">
                <span>Price</span>
                <strong>{formatRupiah(product.price_amount)}</strong>
              </div>
              {product.salesCount !== null ? (
                <p className="digital-product-detail__sales" data-testid="digital-product-detail-sales-count">
                  {product.salesCount.toLocaleString('en-US')} sold
                </p>
              ) : null}
              <AddToCartButton commerceItemId={product.id} purchaseMode={purchaseMode} />
              {purchaseMode === 'mentee' ? (
                <Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/cart">
                  <ShoppingCart aria-hidden="true" size={16} /> View cart
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </MarketingShell>
  )
}
