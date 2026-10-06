import { Archive, CircleCheck, CircleX, Clock3, Tag } from 'lucide-react'

export const competitionStatusIcons = {
  upcoming: Clock3,
  open: CircleCheck,
  closed: CircleX,
  archived: Archive,
}

export function CompetitionBadges({ status, category }: {
  status: keyof typeof competitionStatusIcons
  category: string | null
}) {
  const StatusIcon = competitionStatusIcons[status]

  return <div className="editorial-competition-badges">
    <span className={`editorial-competition-badge editorial-competition-badge--${status}`}>
      <StatusIcon aria-hidden="true" size={13} /> {status}
    </span>
    {category ? <span className="editorial-competition-badge editorial-competition-badge--category">
      <Tag aria-hidden="true" size={13} /> {category}
    </span> : null}
  </div>
}
