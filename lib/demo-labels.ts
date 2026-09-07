import { displayLabel } from './labels'

// Presentation only: recognize app-generated demo copy without rewriting storage.
const legacyLabels: Record<string, string> = {
  'Competition Preparation': 'Persiapan Kompetisi',
  'Leadership Lab': 'Laboratorium Kepemimpinan',
  'Career Launchpad': 'Landasan Karier',
  'Pitch Deck Review': 'Tinjauan Presentasi Bisnis',
  'Business Plan Preparation': 'Persiapan Rencana Bisnis',
  'Case Structuring': 'Penyusunan Struktur Kasus',
  'Solution Development': 'Pengembangan Solusi',
  'September 2026 Cohort': 'Angkatan September 2026',
  'July 2026 Cohort': 'Angkatan Juli 2026',
  'Case Simulation': 'Simulasi Kasus',
  'Competition Prep Workbook': 'Buku Latihan Persiapan Kompetisi',
  'Private Mentoring Session Top-up': 'Tambahan Sesi Mentoring Privat',
  'Digital download': 'Unduhan digital',
  'Just now': 'Baru saja',
  'this program': 'program ini',
}

const months: Record<string, string> = {
  Jan: 'Jan', Feb: 'Feb', Mar: 'Mar', Apr: 'Apr', May: 'Mei', Jun: 'Jun',
  Jul: 'Jul', Aug: 'Agu', Sep: 'Sep', Oct: 'Okt', Nov: 'Nov', Dec: 'Des',
}
const days: Record<string, string> = {
  Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab', Sun: 'Min',
}

export function displayDemoLabel(value: string): string {
  const label = displayLabel(value)
  if (label !== value) return label
  if (Object.hasOwn(legacyLabels, value)) return legacyLabels[value]

  const sessions = /^(\d+) (Additional )?Sessions$/.exec(value)
  if (sessions) return `${sessions[1]} Sesi${sessions[2] ? ' Tambahan' : ''}`

  const price = /^Rp ?(\d+(?:\.\d+)?)(K|M)$/.exec(value)
  if (price) return `Rp ${price[1].replace('.', ',')} ${price[2] === 'K' ? 'ribu' : 'juta'}`

  const date = /^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/.exec(value)
  if (date) return `${date[1]} ${months[date[2]]} ${date[3]}`

  const usDate = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(value)
  if (usDate) return `${usDate[2]} ${months[usDate[1]]} ${usDate[3]}`

  const schedule = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) · (\d{2}:\d{2} WIB)$/.exec(value)
  if (schedule) return `${days[schedule[1]]}, ${schedule[2]} ${months[schedule[3]]} · ${schedule[4]}`

  const today = /^Today · (\d{2}:\d{2})$/.exec(value)
  if (today) return `Hari ini · ${today[1]}`

  return value
}

const notificationCopy: Record<string, string> = {
  'Your Private Mentoring engagement has an upcoming session.': 'Paket Mentoring Privat Anda memiliki sesi mendatang.',
  'Your product is now available in My Library.': 'Produk Anda kini tersedia di Pustaka Saya.',
  'Your enrollment is ready for the next step.': 'Program Anda siap untuk langkah berikutnya.',
}
const purchaseTitles = new Set([
  'Private Mentoring', 'Intensive Mentoring', 'Business Case Intensive', 'Business Case Big Class',
  'Leadership Lab', 'Career Launchpad', 'Pitch Deck Starter Kit',
  'Case Cracking Playbook', 'Private Mentoring Session Top-up',
  'Mentoring Privat', 'Mentoring Intensif', 'Mentoring Intensif Kasus Bisnis', 'Kelas Besar Kasus Bisnis',
  'Laboratorium Kepemimpinan', 'Landasan Karier', 'Paket Awal Materi Presentasi', 'Paket Awal Presentasi Bisnis',
  'Panduan Pemecahan Kasus', 'Tambahan Sesi Mentoring Privat',
])

export function displayDemoNotification(value: string): string {
  if (Object.hasOwn(notificationCopy, value)) return notificationCopy[value]

  const purchase = /^(.+) (?:purchase successful|berhasil dibeli)\.$/.exec(value)
  if (purchase && purchaseTitles.has(purchase[1])) return `${displayDemoLabel(purchase[1])} berhasil dibeli.`

  const assignment = /^(Albert L\.|Navira A\.|Salsabila Putri|Raka Wijaya) has been assigned\.$/.exec(value)
  if (assignment) return `${assignment[1]} telah ditugaskan.`

  const assignedProgram = /^(Albert L\.|Navira A\.|Salsabila Putri|Raka Wijaya) (?:is assigned to|ditugaskan untuk) (.+)\.$/.exec(value)
  if (assignedProgram) return `${assignedProgram[1]} ditugaskan untuk ${displayDemoLabel(assignedProgram[2])}.`

  return value
}
