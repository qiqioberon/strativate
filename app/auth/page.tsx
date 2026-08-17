'use client'

import { ArrowRight, Check, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react'

const roles = [
  { key: 'mentee', title: 'Continue as a mentee', desc: 'Find your program, book mentors, and track your next win.', icon: Sparkles, href: '/dashboard', tone: 'orange' },
  { key: 'mentor', title: 'Continue as a mentor', desc: 'Manage sessions, support students, and grow your impact.', icon: Users, href: '/mentor', tone: 'red' },
  { key: 'admin', title: 'Continue as an admin', desc: 'Monitor the Strativate platform and keep everything moving.', icon: ShieldCheck, href: '/admin', tone: 'yellow' },
]

export default function AuthPage() {
  return <main className="auth-page"><div className="auth-card"><a href="/" className="brand" aria-label="Back to Strativate home"><span className="brand-mark">S</span><span>strativate</span></a><div className="auth-heading"><p className="kicker">Welcome back</p><h1>Choose your <em>workspace.</em></h1><p>For this prototype, pick the role you want to preview. In the full product, Google sign-in will take you to the right dashboard automatically.</p></div><div className="role-cards">{roles.map(({ key, title, desc, icon: Icon, href, tone }) => <a className={`role-card ${tone}`} href={href} key={key}><span className="icon-wrap"><Icon size={22} /></span><span><strong>{title}</strong><small>{desc}</small></span><ArrowRight size={18} /></a>)}</div><div className="auth-note"><Check size={15} /> Secure Google sign-in · Role-based access</div><a className="auth-back" href="/">Return to Strativate</a></div><div className="auth-side"><Trophy size={30} /><p>Win early.<br /><strong>Get ahead.</strong></p></div></main>
}

export const dynamic = 'force-static'
