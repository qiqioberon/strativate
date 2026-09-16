import { MentorDirectory } from '@/components/marketing/mentor-directory'
import type { PublicMentor } from '@/lib/mentor/public-profile-types'

const mentors: PublicMentor[] = [
  {
    slug: 'published-mentor',
    name: 'Published Mentor',
    tier: 'Top Student',
    title: 'Strategy Mentor',
    shortBio: 'Bio publik yang aman ditampilkan dari DTO direktori.',
    credentials: ['National Business Case Winner', 'Case Team Lead'],
    expertise: ['Business Case', 'Finance'],
    linkedIn: 'https://www.linkedin.com/in/published-mentor/',
    portrait: 'mentors.navira-putri.portrait',
    portraitUrl: null,
    photoStatus: 'ready',
  },
  {
    slug: 'published-mentor-two',
    name: 'Published Mentor Two',
    tier: 'Young Professional',
    credentials: ['Marketing Competition Winner'],
    expertise: ['Marketing'],
    portrait: 'mentors.ivonne-qiu.portrait',
    portraitUrl: null,
    photoStatus: 'missing',
  },
]

export default function PublicMentorFixture() {
  return (
    <main className="marketing-page-section" data-testid="public-mentor-fixture">
      <div className="marketing-container">
        <MentorDirectory mentors={mentors} />
      </div>
    </main>
  )
}
