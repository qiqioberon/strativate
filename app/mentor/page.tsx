'use client'

import { Dashboard } from '../page'

export default function MentorDashboard() {
  return <Dashboard role="mentor" go={() => { window.location.href = '/auth' }} notify={(message) => window.alert(message)} />
}
