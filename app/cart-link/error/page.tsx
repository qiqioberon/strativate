import Link from 'next/link'

export default async function CartLinkErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  const unauthorized = reason === 'not-authorized'
  return (
    <main className="commerce-page">
      <div className="commerce-page__container">
        <section className="commerce-empty-state">
          <h1>Cart Link tidak dapat digunakan.</h1>
          <p>{unauthorized ? 'Cart Link ini dibuat untuk akun mentee yang berbeda.' : 'Tautan tidak valid, sudah tidak aktif, atau itemnya sudah tidak tersedia.'}</p>
          <Link className="button button-primary" href="/program/private-mentoring">Kembali ke Private Mentoring</Link>
        </section>
      </div>
    </main>
  )
}
