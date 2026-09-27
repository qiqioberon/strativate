import { WhoWeAreCollage } from '../../../../../components/marketing/who-we-are-collage'
import type { HomepageWhoWeArePhotoView } from '../../../../../lib/marketing/who-we-are-photos'

const photos: HomepageWhoWeArePhotoView[] = [
  {
    role: 'primary',
    imageUrl: '/who-we-are-missing.webp',
    alt_text: 'Unavailable editorial fixture',
    badge_text: null,
  },
  {
    role: 'upper_right',
    imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221200%22 height=%22900%22%3E%3Crect width=%221200%22 height=%22900%22 fill=%22%23687f71%22/%3E%3C/svg%3E',
    alt_text: 'Upper-right editorial fixture',
    badge_text: null,
  },
  {
    role: 'lower_right',
    imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221000%22 height=%221000%22%3E%3Crect width=%221000%22 height=%221000%22 fill=%22%23d0a55a%22/%3E%3C/svg%3E',
    alt_text: 'Lower-right editorial fixture',
    badge_text: 'Collaborative preparation',
  },
]

export default function WhoWeAreFixture() {
  return (
    <main className="marketing-site">
      <section className="marketing-section homepage-who">
        <div className="marketing-container">
          <WhoWeAreCollage photos={photos} />
        </div>
      </section>
    </main>
  )
}
