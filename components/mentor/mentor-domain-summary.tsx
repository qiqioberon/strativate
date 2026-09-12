export function MentorDomainSummary({ tierName, timezone }: { tierName: string | null; timezone: string }) {
  return <dl className="mentor-domain-summary">
    <div><dt>Tier mentor</dt><dd>{tierName || 'Tier belum ditentukan'}</dd></div>
    <div><dt>Zona waktu</dt><dd>{timezone}</dd></div>
  </dl>
}
