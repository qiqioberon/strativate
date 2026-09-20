import Link from 'next/link'
import { Link2Off } from 'lucide-react'

export default async function CartLinkErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  const unauthorized = reason === 'not-authorized'
  const description = unauthorized
    ? 'Cart Link ini hanya dapat digunakan oleh akun mentee yang dituju. Pastikan Anda masuk dengan akun yang menerima tautan tersebut.'
    : 'Tautan ini sudah tidak aktif, kedaluwarsa, atau tidak lagi tersedia.'

  return (
    <main className="commerce-page">
      <div className="commerce-page__container">
        <section className="commerce-empty-state cart-link-error-state" aria-labelledby="cart-link-error-title">
          <div className="cart-link-error-card">
            <span className="cart-link-error-icon" aria-hidden="true"><Link2Off /></span>
            <div className="cart-link-error-copy">
              <p className="kicker">Cart Link</p>
              <h1 id="cart-link-error-title">Cart Link tidak dapat digunakan.</h1>
              <p>{description}</p>
            </div>
            <Link className="button button-primary" href="/">Kembali ke Beranda</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
