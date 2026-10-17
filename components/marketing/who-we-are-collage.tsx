import { findAwardStyle } from '@/components/marketing/decor/award-tier'
import { FluentIcon } from '@/components/marketing/decor/fluent-icon'
import type { HomepageWhoWeArePhotoView } from '@/lib/marketing/who-we-are-photos'

import { WhoWeArePhoto } from './who-we-are-photo'

// Badges are free admin text, so a medal or trophy mark is added only when the caption itself names a placement or award.
function badgeMarkFor(badge: string | null) {
  const award = findAwardStyle(badge)
  return award ? <FluentIcon name={award.icon} size={20} className="homepage-who__badge-mark" /> : null
}

export function WhoWeAreCollage({ photos }: { photos: HomepageWhoWeArePhotoView[] }) {
  return (
    <div
      className="homepage-who__collage"
      data-count={photos.length}
      data-testid="homepage-who-we-are-collage"
      role="group"
      aria-label="Strativate community photos"
    >
      {photos.map(photo => <WhoWeArePhoto key={photo.role} photo={photo} badgeMark={badgeMarkFor(photo.badge_text)} />)}
    </div>
  )
}
