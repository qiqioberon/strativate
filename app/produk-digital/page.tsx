import { ArrowRight, PackageOpen } from 'lucide-react'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'

import { AssetMedia } from '@/components/marketing/asset-media'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { productPlaceholders } from '@/lib/content/marketing-content'
import { featureFlags } from '@/lib/features'

export default function DigitalProductsPage() {
  if (!featureFlags.digitalProducts) permanentRedirect('/program')

  return (
    <MarketingShell>
      <main>
        <PageIntro
          eyebrow="Produk digital"
          title={<>Materi mandiri,<br /><em>tanpa informasi rekaan.</em></>}
          description="Nama, format, harga, sampul, dan file produk final belum dipublikasikan. Ruang produk tetap tersedia sebagai fondasi visual sampai detail yang disetujui siap ditampilkan."
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
