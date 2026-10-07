import Link from 'next/link'
import { ArrowLeft, Link2Off } from 'lucide-react'

export default async function CartLinkErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  const unauthorized = reason === 'not-authorized'
  const description = unauthorized
    ? 'This Cart Link is only available to the intended mentee account. Sign in with the account that received this link.'
    : 'This link is inactive, expired, or no longer available.'

  return (
    <main className="cart-link-error-page">
      <div className="cart-link-error-shell">
        <section className="cart-link-error-card" aria-labelledby="cart-link-error-title">
          <span className="cart-link-error-icon" aria-hidden="true"><Link2Off /></span>
          <div className="cart-link-error-copy">
            <p className="cart-link-error-kicker">Cart Link</p>
            <h1 id="cart-link-error-title">This Cart Link can&apos;t be used.</h1>
            <p className="cart-link-error-description">{description}</p>
          </div>
          <div className="cart-link-error-actions">
            <Link className="button button-primary" href="/"><ArrowLeft aria-hidden="true" size={17} />Back to Home</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
