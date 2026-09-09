import { ArrowRight, PackageOpen } from 'lucide-react'
import Link from 'next/link'

import { AssetMedia } from '@/components/marketing/asset-media'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { productPlaceholders } from '@/lib/content/marketing-content'

export default function DigitalProductsPage() {
  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Produk digital"
          title={<>Materi mandiri,<br /><em>tanpa informasi rekaan.</em></>}
          description="Katalog ini menunggu master nama, format, harga, sampul, dan file produk yang disetujui Strativate."
          aside={<Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/program">Jelajahi program <ArrowRight data-icon="arrow" size={16} /></Link>}
        />
        <section className="marketing-page-section">
          <div className="marketing-container marketing-products-directory">
            {productPlaceholders.map((product, index) => (
              <article key={product.id}>
                <AssetMedia assetKey={product.cover} sizes="(max-width: 760px) 92vw, 38vw" />
                <div><span>{product.eyebrow}</span><strong>0{index + 1}</strong></div>
                <h2>{product.title}</h2>
                <p>{product.description}</p>
                <small><PackageOpen aria-hidden="true" size={15} /> Belum tersedia untuk pembelian</small>
              </article>
            ))}
          </div>
        </section>
      </main>
    </MarketingShell>
  )
}
