import { Award, GraduationCap, Star } from 'lucide-react'

import { AssetMedia } from './asset-media'
import type { MentorPreview } from '@/lib/content/marketing-content'

export function MentorCard({ mentor, index }: { mentor: MentorPreview; index: number }) {
  const hasVerifiedProfile = Boolean(mentor.name)

  return (
    <article className="marketing-mentor-card">
      <div className="marketing-mentor-card__media">
        <AssetMedia assetKey={mentor.portrait} sizes="(max-width: 760px) 88vw, 28vw" />
        <span className="marketing-mentor-card__index" aria-hidden="true">0{index + 1}</span>
      </div>
      <div className="marketing-mentor-card__content">
        <span className="marketing-mentor-card__status">
          {hasVerifiedProfile ? 'Mentor Strativate' : 'Profil dalam verifikasi'}
        </span>
        <h3>{mentor.name ?? 'Profil mentor akan hadir di sini'}</h3>
        {(mentor.role || mentor.expertise) && <p>{mentor.role ?? mentor.expertise}</p>}
        <div className="marketing-mentor-card__meta">
          {mentor.university && <span><GraduationCap aria-hidden="true" size={14} />{mentor.university}</span>}
          {mentor.achievement && <span><Award aria-hidden="true" size={14} />{mentor.achievement}</span>}
          {typeof mentor.rating === 'number' && <span><Star aria-hidden="true" size={14} />{mentor.rating.toFixed(1)}</span>}
        </div>
      </div>
    </article>
  )
}
