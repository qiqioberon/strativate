'use client'

import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'

const roles = [
  { label: 'Mentee', href: '/dashboard' },
  { label: 'Mentor', href: '/mentor' },
  { label: 'Admin', href: '/admin' },
]

export function DemoRoleSwitcher() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('Mentee')

  useEffect(() => {
    const saved = window.localStorage.getItem('strativate-demo-role')
    if (saved) setRole(saved)
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
        </div>
      )}
      <button className="demo-role-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <FlaskConical size={14} /> Demo Role · {role}
      </button>
    </div>
  )
}
