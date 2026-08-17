'use client'

import { useState } from 'react'
import { CalendarDays, Check, MessageCircle, UserRound } from 'lucide-react'
import { Dashboard } from '../page'
import { DemoOrder, readOrder, writeOrder } from '@/lib/demo-store'

export default function MentorDashboard() {
  const [order, setOrder] = useState<DemoOrder | null>(() => readOrder())
  const [note, setNote] = useState('I have a university event at the requested time. Could we move this session to the next available slot?')
  const requestReschedule = () => { if (!order) return; const updated = { ...order, status: 'Reschedule requested' as const, rescheduleNote: note }; writeOrder(updated); setOrder(updated); window.alert('Reschedule request sent to admin.') }
  return <Dashboard role="mentor" go={() => { window.location.href = '/auth' }} notify={(message) => window.alert(message)}>
    <section className="mentor-workspace"><div className="admin-heading"><div><p className="kicker">Mentor workspace</p><h2>Your assigned sessions.</h2><p>See what is next, prepare with context, and ask admin for changes when needed.</p></div><span className="badge">This week</span></div>{order ? <div className="mentor-session-layout"><section className="booking-panel"><div className="session-hero"><span className="avatar large-avatar">MK</span><div><p className="kicker">Assigned session · {order.id}</p><h3>{order.subject}</h3><p>with Marsha K. · {order.program}</p></div><span className="status-chip">{order.status}</span></div><div className="session-detail-grid"><div><CalendarDays /><span>Schedule<strong>{order.schedule}</strong></span></div><div><UserRound /><span>Student<strong>Marsha K.</strong></span></div><div><MessageCircle /><span>Format<strong>Online · 75 minutes</strong></span></div></div><div className="reschedule-box"><p className="kicker">Need a different time?</p><h4>Ask admin to reschedule</h4><textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="Reschedule reason" /><button className="button button-primary" onClick={requestReschedule}>Send request <MessageCircle size={15} /></button></div></section><aside className="order-summary"><p className="kicker">Session prep</p><h3>{order.subject}</h3><ul className="admin-checklist"><li><Check /> Review case brief</li><li><Check /> Prepare feedback notes</li><li><Check /> Join 5 minutes early</li></ul></aside></div> : <div className="empty-order"><p className="kicker">No assigned sessions</p><h3>Your calendar is clear.</h3><p>Admin assignments will appear here after a mentee completes payment.</p></div>}</section>
  </Dashboard>
}
