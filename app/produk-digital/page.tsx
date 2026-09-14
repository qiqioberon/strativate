import { ArrowRight, PackageOpen } from 'lucide-react'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'

import { AddToCartButton } from '@/components/digital-products/add-to-cart-button'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { getAccount } from '@/lib/auth/server'
import { formatRupiah } from '@/lib/commerce/money'
import { resolveDigitalPurchaseMode } from '@/lib/commerce/purchase-mode'
import { listPublicDigitalProducts } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'

export default async function DigitalProductsPage() {
  if (!isDigitalProductsEnabled()) permanentRedirect('/program')
  const [products, account] = await Promise.all([
    listPublicDigitalProducts(),
    getAccount(),
  ])
  const purchaseMode = resolveDigitalPurchaseMode(account)

  return (
    <MarketingShell digitalProductsEnabled>
      <main>
        <PageIntro
          eyebrow="Produk digital"
          title={<>Materi mandiri,<br /><em>langsung dari Strativate.</em></>}
          description="Jelajahi Produk Digital yang saat ini tersedia. Informasi yang ditampilkan berasal dari data produk yang dikelola Strativate."
          aside={<Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/program">Jelajahi program <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section digital-products-section">
          <div className="marketing-container">
            {products.length === 0 ? (
              <div className="digital-products-empty">
                <PackageOpen aria-hidden="true" size={28} />
                <h2>Belum ada Produk Digital yang tersedia.</h2>
                <p>Produk yang sudah dipublikasikan oleh Strativate akan muncul di halaman ini.</p>
              </div>
            ) : (
              <div className="marketing-products-directory digital-products-directory">
                {products.map((product) => (
                  <article key={product.id} className="digital-product-card">
                    <Link className="digital-product-cover" href={`/produk-digital/${product.slug}`} aria-label={`Lihat ${product.name}`}>
                      {product.imageUrl ? (
                        // Public covers are marketing assets served by Supabase Storage.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt={`Sampul ${product.name}`} loading="lazy" />
                      ) : (
                        <div className="digital-product-cover__fallback" aria-hidden="true">Strativate</div>
                      )}
                    </Link>
                    <div className="digital-product-card__body">
                      <span className="marketing-kicker">Produk Digital</span>
                      <h2>{product.name}</h2>
                      <p className="digital-product-card__description">{product.description}</p>
                      <div className="digital-product-card__price">
                        <span>Harga</span>
                        <strong>{formatRupiah(product.price_amount)}</strong>
                      </div>
                      <div className="digital-product-card__actions">
                        <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/produk-digital/${product.slug}`}>
                          Lihat detail <ArrowRight aria-hidden="true" size={15} />
                        </Link>
                        <AddToCartButton
                          commerceItemId={product.id}
                          purchaseMode={purchaseMode}
                          compact
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
