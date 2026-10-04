import { ArrowRight, PackageOpen } from 'lucide-react'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'

import { DigitalProductDirectory } from '@/components/digital-products/digital-product-directory'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { PageIntro } from '@/components/marketing/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { listPublicDigitalProducts } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'

export default async function DigitalProductsPage() {
  if (!isDigitalProductsEnabled()) permanentRedirect('/program')
  const products = await listPublicDigitalProducts()

  return <MarketingShell digitalProductsEnabled><main><PageIntro title="Digital Products" description="Explore approved digital products and choose practical resources to support your learning journey." aside={<Link className={buttonVariants({ variant: 'outline', size: 'marketing' })} href="/program">Explore Programs <ArrowRight data-icon="arrow" size={16} /></Link>} /><section className="marketing-page-section digital-products-section"><div className="marketing-container">{products.length === 0 ? <div className="digital-products-empty"><PackageOpen aria-hidden="true" size={28} /><h2>No digital products are available yet.</h2><p>Products published by Strativate will appear here when they are ready.</p></div> : <DigitalProductDirectory products={products} />}</div></section></main></MarketingShell>
}
