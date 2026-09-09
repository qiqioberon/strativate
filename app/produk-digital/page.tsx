import { ArrowRight, PackageOpen } from 'lucide-react'
import Link from 'next/link'

import { AssetMedia } from '@/components/marketing/asset-media'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { selectDigitalProducts, toMarketingDigitalProduct } from '@/lib/catalog/presentation'
import { listPublicCatalog } from '@/lib/catalog/public'
import { productPlaceholders } from '@/lib/content/marketing-content'

export default async function DigitalProductsPage() {
  const catalogProducts = await listPublicCatalog()
  const digitalProducts = selectDigitalProducts(catalogProducts).map(toMarketingDigitalProduct)

  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Produk digital"
          title={<>Materi mandiri,<br /><em>tanpa informasi rekaan.</em></>}
          description={digitalProducts.length > 0
            ? 'Katalog materi mandiri yang telah dipublikasikan oleh Strativate.'
            : 'Katalog ini menunggu master nama, format, harga, sampul, dan file produk yang disetujui Strativate.'}
          aside={<Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/program">Jelajahi program <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section">
          <div className="marketing-container marketing-products-directory">
            {(digitalProducts.length > 0 ? digitalProducts : productPlaceholders).map((product, index) => (
              <article key={product.id}>
                <AssetMedia assetKey={product.cover} sizes="(max-width: 760px) 92vw, 38vw" />
                <div><span>{product.eyebrow}</span><strong>0{index + 1}</strong></div>
                <h2>{'href' in product ? <Link href={product.href}>{product.title}</Link> : product.title}</h2>
                <p>{product.description}</p>
                <small><PackageOpen aria-hidden="true" size={15} /> {'priceLabel' in product ? product.priceLabel : 'Belum tersedia untuk pembelian'}</small>
              </article>
            ))}
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
