'use client'

import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, CreditCard, QrCode, ShieldCheck, Sparkles } from 'lucide-react'
import { Dashboard } from '../page'
import { DemoOrder, formatOrderDate, mentorOptions, programOptions, readOrder, scheduleOptions, writeOrder } from '@/lib/demo-store'

export default function MenteeDashboard() {
  const [order, setOrder] = useState<DemoOrder | null>(() => readOrder())
  const [step, setStep] = useState(0)
  const [program, setProgram] = useState(programOptions[0].name)
  const [subject, setSubject] = useState(programOptions[0].subjects[0])
  const [mentor, setMentor] = useState(mentorOptions[0])
  const [schedule, setSchedule] = useState(scheduleOptions[0])

  const selectedProgram = programOptions.find((item) => item.name === program) || programOptions[0]
  const next = () => setStep((value) => Math.min(value + 1, 4))
  const chooseProgram = (value: typeof program) => { setProgram(value); setSubject(programOptions.find((item) => item.name === value)?.subjects[0] || '') }
  const createOrder = () => {
    const nextOrder: DemoOrder = { id: `ST-${Math.floor(1000 + Math.random() * 9000)}`, program, subject, mentor: program === 'Competition Class' ? 'Class facilitator' : mentor, schedule, price: selectedProgram.price, status: 'Awaiting payment', paymentStatus: 'Unpaid', createdAt: formatOrderDate() }
    writeOrder(nextOrder); setOrder(nextOrder); setStep(4)
  }
  const pay = () => { if (!order) return; const paid = { ...order, status: 'Paid · awaiting assignment' as const, paymentStatus: 'Paid' as const }; writeOrder(paid); setOrder(paid) }

  return <Dashboard role="mentee" credits={5} go={(view) => { if (view === 'mentors') window.location.href = '/#mentors'; else window.location.href = '/auth' }} notify={(message) => window.alert(message)}>
    <div className="booking-shell">
      <div className="booking-head"><div><p className="kicker">Mentee workspace</p><h2>{order ? 'Your application is moving.' : 'Find the right preparation path.'}</h2><p>Choose a program, shape your focus, and reserve a time that works for you.</p></div>{order && <span className="badge">Order {order.id}</span>}</div>
      {!order ? <>
        <div className="booking-steps">{['Program', 'Subject', 'Mentor', 'Schedule', 'Payment'].map((item, index) => <span className={index <= step ? 'active' : ''} key={item}><b>{index + 1}</b>{item}</span>)}</div>
        {step === 0 && <section className="booking-panel"><p className="kicker">Step 1</p><h3>Choose your preparation style.</h3><div className="choice-grid">{programOptions.map((item) => <button className={`choice-card ${program === item.name ? 'selected' : ''}`} key={item.name} onClick={() => chooseProgram(item.name)}><span>{item.name}</span><strong>{item.price}</strong><small>{item.detail}</small>{program === item.name && <Check />}</button>)}</div><button className="button button-primary booking-next" onClick={next}>Continue <ArrowRight size={16} /></button></section>}
        {step === 1 && <section className="booking-panel"><p className="kicker">Step 2</p><h3>What do you want to sharpen?</h3><div className="subject-grid">{selectedProgram.subjects.map((item) => <button className={`subject-card ${subject === item ? 'selected' : ''}`} key={item} onClick={() => setSubject(item)}>{item}{subject === item && <Check />}</button>)}</div><button className="button button-primary booking-next" onClick={next}>Choose mentor <ArrowRight size={16} /></button></section>}
        {step === 2 && <section className="booking-panel"><p className="kicker">Step 3</p><h3>Pick who you want to learn from.</h3><div className="subject-grid">{mentorOptions.map((item) => <button className={`subject-card mentor-choice ${mentor === item ? 'selected' : ''}`} key={item} onClick={() => setMentor(item)}><span className="avatar">{item.split(' ').map((word) => word[0]).join('')}</span><span>{item}</span>{mentor === item && <Check />}</button>)}</div><button className="button button-primary booking-next" onClick={next}>Choose schedule <CalendarDays size={16} /></button></section>}
        {step === 3 && <section className="booking-panel"><p className="kicker">Step 4</p><h3>Reserve your practice time.</h3><div className="schedule-list">{scheduleOptions.map((item) => <button className={`schedule-card ${schedule === item ? 'selected' : ''}`} key={item} onClick={() => setSchedule(item)}><CalendarDays /><span>{item}<small>75 minute session · Online</small></span>{schedule === item && <Check />}</button>)}</div><button className="button button-primary booking-next" onClick={createOrder}>Review order <ArrowRight size={16} /></button></section>}
      </> : order.paymentStatus === 'Unpaid' ? <PaymentPanel order={order} onPay={pay} onBack={() => { writeOrder(null); setOrder(null); setStep(0) }} /> : <OrderConfirmation order={order} />}
    </div>
  </Dashboard>
}

function PaymentPanel({ order, onPay, onBack }: { order: DemoOrder; onPay: () => void; onBack: () => void }) { return <section className="payment-layout"><div className="booking-panel"><p className="kicker">Step 5 · Prototype payment</p><h3>Reserve your place.</h3><p className="panel-copy">Scan the QR code or use the demo payment button. No real charge will be made.</p><div className="qr-box"><QrCode size={138} /><span>STRATIVATE DEMO QR</span></div><button className="button button-primary full-button" onClick={onPay}><CreditCard size={16} /> Mark as paid</button><button className="button button-ghost full-button" onClick={onBack}>Change selection</button></div><aside className="order-summary"><p className="kicker">Order summary</p><h3>{order.program}</h3><dl><div><dt>Focus</dt><dd>{order.subject}</dd></div><div><dt>Mentor</dt><dd>{order.mentor}</dd></div><div><dt>Schedule</dt><dd>{order.schedule}</dd></div><div><dt>Total</dt><dd>{order.price}</dd></div></dl><p className="secure-note"><ShieldCheck size={15} /> Secure demo checkout</p></aside></section> }
function OrderConfirmation({ order }: { order: DemoOrder }) { return <section className="booking-panel confirmation-panel"><div className="success-mark"><Check /></div><p className="kicker">Payment confirmed · {order.id}</p><h3>You&apos;re on your way to a stronger case.</h3><p className="panel-copy">Your order is paid. Admin will confirm the mentor assignment and session details here.</p><div className="confirmation-grid"><div><span>Program</span><strong>{order.program}</strong></div><div><span>Focus</span><strong>{order.subject}</strong></div><div><span>Requested time</span><strong>{order.schedule}</strong></div><div><span>Current status</span><strong>{order.status}</strong></div></div><div className="timeline"><span className="done"><Check /> Order created</span><span className="done"><Check /> Payment received</span><span><Sparkles /> Mentor assignment pending</span></div></section> }
