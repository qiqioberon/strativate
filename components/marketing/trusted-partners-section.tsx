import type { CSSProperties } from 'react'

import type { TrustedPartnerView } from '@/lib/marketing/trusted-partners'

export function TrustedPartnersSection({ partners }: { partners: TrustedPartnerView[] }) {
  if (!partners.length) return null

  return (
    <section
      className="marketing-section homepage-partners"
      aria-labelledby="homepage-partners-heading"
      data-reveal
      data-testid="homepage-partners-section"
    >
      <div className="marketing-container homepage-partners__inner">
        <header className="homepage-partners__head">
          <p className="marketing-kicker">Trusted Partners</p>
          <h2 id="homepage-partners-heading">Partnered with Leading Organizations</h2>
          <p>We collaborate with prestigious institutions and organizations to create impactful learning experiences</p>
        </header>

        <div
          className="homepage-partners__constellation"
          role="list"
          aria-label="Trusted partner organizations"
          data-count={Math.min(partners.length, 4)}
        >
          {partners.map((partner, index) => (
            <article
              className="homepage-partners__slot"
              key={partner.id}
              role="listitem"
              style={{ '--partner-delay': `${Math.min(index, 11) * 85}ms` } as CSSProperties}
            >
              <div className="homepage-partners__drift">
                <div className="homepage-partners__card">
                  {/* Supabase owns these admin-uploaded public assets, so native images accept the configured project hostname. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={partner.logoUrl}
                    alt={partner.organization_name}
                    width={800}
                    height={400}
                    loading="lazy"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
