export type ProgramKind = 'Private Mentoring' | 'Intensive Mentoring' | 'Competition Class'

export type DemoOrder = {
  id: string
  program: ProgramKind
  subject: string
  mentor: string
  schedule: string
  status: 'Awaiting payment' | 'Paid · awaiting assignment' | 'Scheduled' | 'Reschedule requested'
  paymentStatus: 'Unpaid' | 'Paid'
  price: string
  createdAt: string
  rescheduleNote?: string
}

export const DEMO_STORE_KEY = 'strativate-demo-v1'

export const programOptions: Array<{ name: ProgramKind; price: string; detail: string; subjects: string[] }> = [
  { name: 'Private Mentoring', price: 'Rp 250K', detail: '1:1 focused session with a competition mentor.', subjects: ['Business Case', 'Pitching & Storytelling', 'Market Sizing'] },
  { name: 'Intensive Mentoring', price: 'Rp 1.2M', detail: 'Four sessions to take an idea from rough to ready.', subjects: ['Business Plan', 'Financial Modeling', 'Marketing Strategy'] },
  { name: 'Competition Class', price: 'Rp 450K', detail: 'A small cohort class with frameworks and practice.', subjects: ['Case Competition', 'Business Plan', 'Product Strategy'] },
]

export const mentorOptions = ['Alvin Pratama', 'Salsabila Putri', 'Raka Wijaya']
export const scheduleOptions = ['Thu, 20 Aug · 19:00 WIB', 'Sat, 22 Aug · 10:00 WIB', 'Tue, 25 Aug · 19:00 WIB']

export function readOrder(): DemoOrder | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(window.localStorage.getItem(DEMO_STORE_KEY) || 'null') as DemoOrder | null } catch { return null }
}

export function writeOrder(order: DemoOrder | null) {
  if (typeof window === 'undefined') return
  if (order) window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(order))
  else window.localStorage.removeItem(DEMO_STORE_KEY)
}

export function formatOrderDate() { return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()) }
