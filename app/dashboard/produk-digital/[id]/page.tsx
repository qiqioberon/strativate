import { ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ProtectedContentViewer } from '@/components/digital-products/protected-content-viewer'
import { getOwnedDigitalProduct } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'

export default async function ProtectedDigitalProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDigitalProductsEnabled()) redirect('/dashboard')
  const { id } = await params
  const product = await getOwnedDigitalProduct(id)
  if (!product) notFound()

  return (
    <main className="protected-content-page">
      <header className="protected-content-header">
        <Link href="/dashboard"><ArrowLeft aria-hidden="true" size={17} /> Kembali ke dashboard</Link>
        <div>
          <span><ShieldCheck aria-hidden="true" size={16} /> Produk Digital Saya</span>
          <h1>{product.name_snapshot}</h1>
          <p>{product.contentType === 'video' ? 'Video' : product.contentType === 'pdf' ? 'PDF' : 'Materi digital'} · akses khusus akun pembeli</p>
        </div>
      </header>
      {product.contentReady ? (
        <ProtectedContentViewer productId={product.product_id} title={product.name_snapshot} />
      ) : (
        <section className="protected-content-state">
          <ShieldCheck aria-hidden="true" />
          <h2>Materi sedang disiapkan</h2>
          <p>Pembelian Anda sudah tercatat, tetapi file materi belum tersedia untuk dibuka. Silakan coba lagi setelah administrator menyelesaikan kontennya.</p>
        </section>
      )}
    </main>
  )
}
