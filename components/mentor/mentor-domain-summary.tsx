import { Award, Clock3 } from 'lucide-react'

import styles from './dashboard/mentor-secondary-sections.module.css'

export function MentorDomainSummary({
  tierName,
  timezone,
  language = 'id',
}: {
  tierName: string | null
  timezone: string
  language?: 'id' | 'en'
}) {
  const english = language === 'en'
  return (
    <dl className={`mentor-domain-summary ${styles.domainSummary}`}>
      <div className={styles.domainTile}>
        <span className={styles.domainIcon}><Award aria-hidden="true" /></span>
        <dt>{english ? 'Mentor tier' : 'Tier mentor'}</dt>
        <dd>{tierName || (english ? 'Tier not assigned' : 'Tier belum ditentukan')}</dd>
      </div>
      <div className={styles.domainTile}>
        <span className={styles.domainIcon}><Clock3 aria-hidden="true" /></span>
        <dt>{english ? 'Time zone' : 'Zona waktu'}</dt>
        <dd>{timezone}</dd>
      </div>
    </dl>
  )
}
