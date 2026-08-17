'use client'

import { useState } from 'react'
import { CalendarDays, Check, UserRound } from 'lucide-react'
import { Dashboard } from '../page'
import { DemoOrder, mentorOptions, readOrder, scheduleOptions, writeOrder } from '@/lib/demo-store'

export default function AdminDashboard() {
  const [order, setOrder] = useState<DemoOrder | null>(() => readOrder())
  const [mentor, setMentor] = useState(order?.mentor || mentorOptions[0])
  const [schedule, setSchedule] = useState(order?.schedule || scheduleOptions[0])
  const save = () => { if (!order) return; const updated = { ...order, mentor, schedule, status: 'Scheduled' as const }; writeOrder(updated); setOrder(updated); window.alert('Order updated and marked as scheduled.') }
  return <Dashboard role="admin" go={() => { window.location.href = '/auth' }} notify={(message) => window.alert(message)}>
    <section className="admin-workspace"><div className="admin-heading"><div><p className="kicker">Admin operations</p><h2>Orders & assignments.</h2><p>Review paid applications, assign mentors, and keep every schedule moving.</p></div><span className="badge">Live demo data</span></div>{order ? <div className="admin-order-layout"><section className="booking-panel"><div className="order-title"><div><p className="kicker">Paid order · {order.id}</p><h3>{order.program}</h3></div><span className="status-chip">{order.status}</span></div><div className="confirmation-grid"><div><span>Student</span><strong>Marsha K.</strong></div><div><span>Subject</span><strong>{order.subject}</strong></div><div><span>Paid</span><strong>{order.price}</strong></div><div><span>Requested</span><strong>{order.schedule}</strong></div></div><div className="admin-form-grid"><label><span><UserRound size={14} /> Assign mentor</span><select value={mentor} onChange={(event) => setMentor(event.target.value)}>{mentorOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label><span><CalendarDays size={14} /> Confirm schedule</span><select value={schedule} onChange={(event) => setSchedule(event.target.value)}>{scheduleOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div><button className="button button-primary" onClick={save}><Check size={16} /> Save assignment</button></section><aside className="order-summary"><p className="kicker">Admin checklist</p><h3>Ready to schedule</h3><ul className="admin-checklist"><li><Check /> Payment received</li><li><Check /> Subject selected</li><li><Check /> Mentor availability checked</li></ul><p className="panel-copy">Saving this order makes the assignment visible to the mentor workspace.</p></aside></div> : <div className="empty-order"><p className="kicker">No demo order yet</p><h3>Waiting for a mentee checkout.</h3><p>Open the mentee dashboard and complete a program purchase to create an order here.</p><button className="button button-primary" onClick={() => { window.location.href = '/dashboard' }}>Open mentee dashboard</button></div>}</section>
  </Dashboard>
}
