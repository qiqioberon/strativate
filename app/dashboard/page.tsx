'use client'

import { useState } from 'react'
import { Dashboard } from '../page'

export default function MenteeDashboard() {
  const [credits, setCredits] = useState(5)
  const notify = (message: string) => { setCredits((value) => value); window.alert(message) }
  return <Dashboard role="mentee" credits={credits} go={(view) => { window.location.href = view === 'mentors' ? '/#mentors' : '/auth' }} notify={notify} />
}
