import Link from 'next/link'

import type { HomepageWhoWeArePhotoView } from '@/lib/marketing/who-we-are-photos'

import { WhoWeAreCollage } from './who-we-are-collage'

export function WhoWeAreSection({ photos }: { photos: HomepageWhoWeArePhotoView[] }) {
  return (
    <section
      className={`marketing-section stakeholder-section stakeholder-section--who homepage-who${photos.length ? '' : ' homepage-who--empty'}`}
      aria-labelledby="who-we-are-heading"
      data-reveal
      data-testid="homepage-who-we-are-section"
    >
      <div className="marketing-container homepage-who__layout">
        <div className="homepage-who__copy">
          <p className="marketing-kicker">WHO WE ARE</p>
          <h2 id="who-we-are-heading">Where Future-Ready Skills Meet Competition Success</h2>
          <p className="homepage-who__lede">
            Strativate helps students build practical business skills, sharpen analytical thinking, and prepare for competitions with expert guidance.
          </p>
          <Link className="homepage-who__cta" href="/tentang-kami">Learn More About Us</Link>
        </div>
        {photos.length ? <WhoWeAreCollage photos={photos} /> : null}
      </div>
    </section>
  )
}
