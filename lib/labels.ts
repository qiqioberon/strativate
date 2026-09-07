// Display labels only. Stored values, route keys, and API payloads stay unchanged.
const labels: Record<string, string> = {
  'Private Mentoring': 'Mentoring Privat', 'Intensive Mentoring': 'Mentoring Intensif',
  'Big Class': 'Kelas Besar', 'Digital Products': 'Produk Digital', 'Digital Product': 'Produk Digital',
  All: 'Semua', Featured: 'Unggulan', 'Price low to high': 'Harga terendah', 'Price high to low': 'Harga tertinggi',
  Overview: 'Ringkasan', Orders: 'Pesanan', 'Mentor Assignment': 'Penugasan Mentor', Bookings: 'Jadwal Pesanan',
  Operations: 'Operasional', People: 'Pengguna', Mentees: 'Peserta', Mentors: 'Mentor',
  Products: 'Produk', Services: 'Layanan', Resources: 'Materi', Business: 'Bisnis',
  Payments: 'Pembayaran', Reports: 'Laporan', 'Master Data': 'Data Induk', Institutions: 'Institusi',
  'Referral Sources': 'Sumber Informasi', 'Competition Interests': 'Minat Kompetisi',
  Calendar: 'Kalender', Assignments: 'Penugasan', 'My Mentees': 'Peserta Saya', Programs: 'Program',
  Availability: 'Ketersediaan', 'Session History': 'Riwayat Sesi', Notifications: 'Notifikasi', Profile: 'Profil',
  PAYMENT_PENDING: 'Menunggu pembayaran', PAID: 'Lunas', ASSIGNMENT_PENDING: 'Menunggu penugasan mentor',
  MENTOR_ASSIGNED: 'Mentor ditugaskan', ACTIVE: 'Aktif', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan',
  UPCOMING: 'Akan datang', WAITING_FOR_MENTOR: 'Menunggu mentor', DIGITAL_OWNED: 'Produk tersedia', TOP_UP: 'Tambahan sesi',
  Pending: 'Menunggu', Paid: 'Lunas', Failed: 'Gagal', Refunded: 'Dikembalikan',
  Scheduled: 'Terjadwal', Completed: 'Selesai', Cancelled: 'Dibatalkan',
  'Waiting for Mentor': 'Menunggu mentor', Assigned: 'Ditugaskan', Unassigned: 'Belum ditugaskan',
  'Not scheduled': 'Belum dijadwalkan', 'No Preference': 'Tidak ada preferensi',
  Individual: 'Perorangan', Team: 'Tim', 'Virtual Account': 'Rekening Virtual', 'E-Wallet': 'Dompet Digital',
  Draft: 'Draf', Active: 'Aktif', Inactive: 'Nonaktif', 'Registration open': 'Pendaftaran dibuka',
  admin: 'Admin', mentor: 'Mentor', mentee: 'Peserta', university: 'Universitas', sma: 'SMA', smk: 'SMK',
  pending: 'Menunggu persetujuan', approved: 'Disetujui', rejected: 'Ditolak', archived: 'Diarsipkan',
  admin_manual: 'Ditambahkan admin', user_submitted: 'Diajukan pengguna', import: 'Impor',
  'Business Case': 'Kasus Bisnis', 'Business Plan': 'Rencana Bisnis', 'Equity Research': 'Riset Saham',
  'Friend': 'Teman', 'Friends': 'Teman', 'Organization': 'Organisasi', 'Social Media': 'Media Sosial',
  'Competition Focused': 'Fokus Kompetisi', 'Career Growth': 'Pengembangan Karier', 'Build confidence': 'Membangun kepercayaan diri',
  'Let Strativate match me': 'Bantu pilihkan mentor', 'Weekday evenings': 'Malam hari kerja', 'Weekend mornings': 'Pagi akhir pekan',
  'Flexible scheduling': 'Jadwal fleksibel', bima_kemdiktisaintek: 'BIMA Kemdiktisaintek', school_pdf: 'Dokumen sekolah',
  'Assigned Mentor': 'Mentor yang ditugaskan', 'Business Case Intensive': 'Mentoring Intensif Kasus Bisnis',
  'Business Case Big Class': 'Kelas Besar Kasus Bisnis', 'Case Cracking Playbook': 'Panduan Pemecahan Kasus',
  'Pitch Deck Starter Kit': 'Paket Awal Presentasi Bisnis',
}

export function displayLabel(value: string): string {
  return Object.hasOwn(labels, value) ? labels[value] : value
}
