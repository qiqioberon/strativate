export type ProgramKind = 'Private Mentoring' | 'Intensive Mentoring' | 'Big Class'
export type OrderStatus = 'PAYMENT_PENDING' | 'PAID' | 'ASSIGNMENT_PENDING' | 'MENTOR_INVITED' | 'MENTOR_ASSIGNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REASSIGNMENT_REQUIRED'

export type DemoOrder = { id: string; program: ProgramKind; title: string; subject: string; mentor: string; schedule: string; sessions: number; completed: number; price: string; paymentStatus: 'Unpaid' | 'Paid'; status: OrderStatus; createdAt: string; customer?: string; note?: string }

export const DEMO_STORE_KEY = 'strativate-demo-v2'
export const mentorOptions = ['Albert L.', 'Navira A.', 'Salsabila Putri', 'Raka Wijaya']
export const scheduleOptions = ['Thu, 20 Aug · 19:00 WIB', 'Sat, 22 Aug · 10:00 WIB', 'Tue, 25 Aug · 19:00 WIB']
export const programOptions = [
  { name: 'Private Mentoring' as const, title: 'Private Mentoring', price: 'Rp 750K', detail: 'Three 75-minute sessions with a competition mentor.', subjects: ['HSBC Business Case Competition', 'Pitch Deck Review', 'Business Plan Preparation'], sessions: 3 },
  { name: 'Intensive Mentoring' as const, title: 'Business Case Intensive', price: 'Rp 1.2M', detail: 'Five guided sessions from rough idea to final presentation.', subjects: ['Case Structuring', 'Solution Development', 'Financial Modeling'], sessions: 5 },
  { name: 'Big Class' as const, title: 'Business Case Big Class', price: 'Rp 450K', detail: 'A cohort experience with live classes, materials, and simulations.', subjects: ['July 2026 Cohort', 'Case Simulation', 'Final Presentation'], sessions: 8 },
]

const starterOrders: DemoOrder[] = [
  { id: 'ST-2048', program: 'Private Mentoring', title: 'Private Mentoring', subject: 'HSBC Business Case Competition', mentor: 'Albert L.', schedule: 'Thu, 20 Aug · 19:00 WIB', sessions: 3, completed: 1, price: 'Rp 750K', paymentStatus: 'Paid', status: 'ACTIVE', createdAt: '12 Aug 2026', customer: 'Aqil Farrukh' },
  { id: 'ST-2051', program: 'Intensive Mentoring', title: 'Business Case Intensive', subject: 'Solution Development', mentor: 'Navira A.', schedule: 'Sat, 22 Aug · 10:00 WIB', sessions: 5, completed: 3, price: 'Rp 1.2M', paymentStatus: 'Paid', status: 'ACTIVE', createdAt: '10 Aug 2026', customer: 'Sarah Rahman' },
  { id: 'ST-2054', program: 'Big Class', title: 'Business Case Big Class', subject: 'July 2026 Cohort', mentor: 'Salsabila Putri', schedule: 'Mon, 24 Aug · 10:00 WIB', sessions: 8, completed: 4, price: 'Rp 450K', paymentStatus: 'Paid', status: 'ACTIVE', createdAt: '08 Aug 2026', customer: 'Dimas Prakoso' },
]

export function readOrders(): DemoOrder[] { if (typeof window === 'undefined') return starterOrders; try { const raw = window.localStorage.getItem(DEMO_STORE_KEY); return raw ? JSON.parse(raw) : starterOrders } catch { return starterOrders } }
export function writeOrders(orders: DemoOrder[]) { if (typeof window !== 'undefined') window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(orders)) }
export function readOrder(): DemoOrder | null { return readOrders()[0] || null }
export function writeOrder(order: DemoOrder | null) { const orders = readOrders(); if (order) writeOrders([order, ...orders.filter((item) => item.id !== order.id)]); else writeOrders(orders.slice(1)) }
export function formatOrderDate() { return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()) }
