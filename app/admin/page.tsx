'use client'

import { Dashboard } from '../page'

export default function AdminDashboard() {
  return <Dashboard role="admin" go={() => { window.location.href = '/auth' }} notify={(message) => window.alert(message)} />
}
