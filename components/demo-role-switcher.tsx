'use client'

import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { readState, resetDemoState } from '@/lib/demo-store'

const roles = [
  { label: 'Mentee', href: '/dashboard' },
  { label: 'Mentor', href: '/mentor' },
  { label: 'Admin', href: '/admin' },
]

export function DemoRoleSwitcher() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('Mentee')
  const [inspect, setInspect] = useState(false)
  const [counts, setCounts] = useState({ orders: 0, enrollments: 0, engagements: 0, appointments: 0, digital: 0 })

  useEffect(() => {
    const saved = window.localStorage.getItem('strativate-demo-role')
    if (saved) setRole(saved)
    const state = readState()
    setCounts({ orders: state.orders.length, enrollments: state.enrollments.length, engagements: state.engagements.length, appointments: state.appointments.length, digital: state.digitalPurchases.length })
  }, [])

  function switchRole(label: string, href: string) {
    window.localStorage.setItem('strativate-demo-role', label)
    setRole(label)
    window.location.href = href
  }

  return (
    <div className="demo-role-switcher">
      {open && (
        <div className="demo-role-menu" role="menu" aria-label="Choose demo role">
          <span>Development demo</span>
          {roles.map((item) => (
            <button key={item.label} className={role === item.label ? 'selected' : ''} onClick={() => switchRole(item.label, item.href)} role="menuitem">
              {item.label}
              {role === item.label && <b>Current</b>}
            </button>
          ))}
          <button onClick={() => setInspect((value) => !value)} role="menuitem">Inspect Demo State <b>{inspect ? 'Hide' : 'View'}</b></button>
          {inspect && <div className="demo-state-counts"><small>Orders {counts.orders} · Enrollments {counts.enrollments}</small><small>Engagements {counts.engagements} · Appointments {counts.appointments}</small><small>Digital purchases {counts.digital}</small></div>}
          <button onClick={() => { resetDemoState(); window.location.reload() }} role="menuitem">Reset Demo Data</button>
        </div>
      )}
      <button className="demo-role-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <FlaskConical size={14} /> Demo Role · {role}
      </button>
    </div>
  )
}
