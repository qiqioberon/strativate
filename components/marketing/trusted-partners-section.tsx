import type { TrustedPartnerView } from '@/lib/marketing/trusted-partners'

type PartnerWallProps = {
  className: string
  columnCount: number
  minimumRows: number
  partners: TrustedPartnerView[]
}

function distributePartners(partners: TrustedPartnerView[], columnCount: number, minimumRows: number) {
  const visualCount = Math.max(partners.length, columnCount * minimumRows)
  const columns = Array.from({ length: columnCount }, () => [] as TrustedPartnerView[])

  for (let index = 0; index < visualCount; index += 1) {
    columns[index % columnCount].push(partners[index % partners.length])
  }

  return columns
}

function PartnerCard({ partner }: { partner: TrustedPartnerView }) {
  return (
    <article className="homepage-partners__card">
      {/* Supabase owns these admin-uploaded public assets, so native images accept the configured project hostname. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={partner.logoUrl} alt="" width={800} height={400} loading="lazy" />
    </article>
  )
}

function PartnerWall({ className, columnCount, minimumRows, partners }: PartnerWallProps) {
  const columns = distributePartners(partners, columnCount, minimumRows)

  return (
    <div className={`homepage-partners__wall ${className}`} aria-hidden="true">
      {columns.map((column, columnIndex) => (
        <div className="homepage-partners__column" key={columnIndex}>
          <div className="homepage-partners__track">
            <div className="homepage-partners__group">
              {column.map((partner, index) => (
                <PartnerCard partner={partner} key={`${partner.id}-primary-${index}`} />
              ))}
            </div>
            <div className="homepage-partners__group">
              {column.map((partner, index) => (
                <PartnerCard partner={partner} key={`${partner.id}-clone-${index}`} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

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

        <div className="homepage-partners__gallery">
          <PartnerWall className="homepage-partners__wall--desktop" columnCount={4} minimumRows={5} partners={partners} />
          <PartnerWall className="homepage-partners__wall--tablet" columnCount={3} minimumRows={5} partners={partners} />
          <PartnerWall className="homepage-partners__wall--mobile" columnCount={2} minimumRows={5} partners={partners} />

          <ul className="homepage-partners__static-grid" aria-label="Trusted partner organizations">
            {partners.map((partner) => (
              <li className="homepage-partners__card" key={partner.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={partner.logoUrl}
                  alt={partner.organization_name}
                  width={800}
                  height={400}
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
