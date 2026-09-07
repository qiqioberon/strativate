import { mentoringPrograms } from './program-information'

export type CatalogItem = {
  id: string
  slug: string
  category: 'Private Mentoring' | 'Intensive Mentoring' | 'Big Class' | 'Digital Products'
  title: string
  kicker: string
  description: string
  detail: string
  price: number
  priceLabel: string
  sessions: number
  format: string
  duration: string
  tags: string[]
  outcomes: string[]
  featured?: boolean
  informationOnly?: boolean
}

export const catalogItems: CatalogItem[] = [
  ...mentoringPrograms,
  { id: 'class-leadership', slug: 'leadership-lab', category: 'Big Class', title: 'Laboratorium Kepemimpinan', kicker: 'Belajar bersama kelompok', description: 'Latih kebiasaan kepemimpinan secara langsung bersama peserta yang menghadapi langkah serupa.', detail: 'Belajar dalam kelompok terstruktur melalui sesi langsung, diskusi antarpeserta, dan tantangan praktis yang dapat diterapkan di tempat kerja.', price: 450000, priceLabel: 'Rp450.000', sessions: 8, format: 'Kelas kelompok daring langsung', duration: '8 minggu', tags: ['Kepemimpinan', 'Kelompok belajar'], outcomes: ['Sistem kerja kepemimpinan', 'Saling mendukung komitmen antarpeserta', 'Proyek tantangan praktis'] },
  { id: 'class-career', slug: 'career-launchpad', category: 'Big Class', title: 'Landasan Karier', kicker: 'Belajar bersama kelompok', description: 'Kelas kelompok praktis untuk merencanakan langkah karier berikutnya dengan terarah.', detail: 'Bangun strategi karier yang dapat diterapkan berulang bersama peserta yang menghadapi perubahan serupa.', price: 550000, priceLabel: 'Rp550.000', sessions: 6, format: 'Kelas kelompok daring langsung', duration: '6 minggu', tags: ['Karier', 'Kelompok belajar'], outcomes: ['Arah karier', 'Pemosisian diri', 'Rencana perkembangan mingguan'] },
  { id: 'digital-pitch', slug: 'pitch-deck-starter-kit', category: 'Digital Products', title: 'Paket Awal Materi Presentasi', kicker: 'Materi belajar mandiri', description: 'Templat dan panduan untuk presentasi ide yang lebih jelas dan meyakinkan.', detail: 'Materi unduhan praktis berisi struktur yang dapat disunting, contoh, dan panduan untuk mengubah ide menjadi presentasi yang meyakinkan.', price: 79000, priceLabel: 'Rp79.000', sessions: 0, format: 'Unduhan digital', duration: 'Belajar mandiri', tags: ['Templat', 'Belajar mandiri'], outcomes: ['Struktur presentasi yang dapat disunting', 'Panduan penyusunan cerita', 'Daftar periksa evaluasi'], featured: true },
  { id: 'digital-case', slug: 'case-cracking-playbook', category: 'Digital Products', title: 'Panduan Pemecahan Kasus', kicker: 'Materi belajar mandiri', description: 'Panduan PDF praktis untuk mempertajam cara berpikir dalam memecahkan kasus.', detail: 'Gunakan kerangka kerja yang dapat diterapkan berulang untuk menyusun kasus baru, membangun sudut pandang, dan menyampaikan rekomendasimu.', price: 99000, priceLabel: 'Rp99.000', sessions: 0, format: 'Unduhan digital', duration: 'Belajar mandiri', tags: ['Panduan', 'Kasus'], outcomes: ['Kerangka analisis kasus', 'Panduan latihan', 'Daftar periksa presentasi'] },
]

export const categories = ['All', 'Private Mentoring', 'Intensive Mentoring', 'Big Class', 'Digital Products'] as const
export const getCatalogItem = (slug: string) => catalogItems.find((item) => item.slug === slug)
