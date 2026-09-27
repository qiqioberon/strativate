import type { HomepageWhoWeArePhotoView } from '@/lib/marketing/who-we-are-photos'

import { WhoWeArePhoto } from './who-we-are-photo'

export function WhoWeAreCollage({ photos }: { photos: HomepageWhoWeArePhotoView[] }) {
  return (
    <div
      className="homepage-who__collage"
      data-count={photos.length}
      data-testid="homepage-who-we-are-collage"
      aria-label="Strativate community photos"
    >
      {photos.map(photo => <WhoWeArePhoto key={photo.role} photo={photo} />)}
    </div>
  )
}
