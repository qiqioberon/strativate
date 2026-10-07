import { ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ProtectedContentViewer } from '@/components/digital-products/protected-content-viewer'
import { RatingFeedback } from '@/components/digital-products/rating-feedback'
import { getOwnedDigitalProduct } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'
import styles from '../../mentee-dashboard.module.css'

export default async function ProtectedDigitalProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDigitalProductsEnabled()) redirect('/dashboard')
  const { id } = await params
  const product = await getOwnedDigitalProduct(id)
  if (!product) notFound()

  return (
    <main className={`protected-content-page ${styles.reader}`} lang="en">
      <header className="protected-content-header">
        <Link href="/dashboard"><ArrowLeft aria-hidden="true" size={17} /> Back to dashboard</Link>
        <div>
          <h1>{product.name_snapshot}</h1>
          <p>{product.contentType === 'video' ? 'Video' : product.contentType === 'pdf' ? 'PDF' : 'Digital material'} · Purchased access</p>
        </div>
      </header>
      {product.contentReady ? (
        <ProtectedContentViewer productId={product.product_id} title={product.name_snapshot} language="en" />
      ) : (
        <section className="protected-content-state">
          <ShieldCheck aria-hidden="true" />
          <h2>Material is being prepared</h2>
          <p>Your purchase is confirmed. Please check back when the material is available.</p>
        </section>
      )}
      <RatingFeedback productId={product.product_id} productName={product.name_snapshot} language="en" />
    </main>
  )
}
