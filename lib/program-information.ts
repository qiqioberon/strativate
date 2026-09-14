import type { MentoringSlug } from '@/lib/program-routes'

type ContentItem = { title: string; description: string }

export type ProgramEditorial = {
  slug: MentoringSlug
  title: 'Private Mentoring' | 'Intensive Mentoring'
  shortDescription: string
  kicker: string
  detail: string
  audience: string
  highlights: string[]
  journey: ContentItem[]
  tone: 'orange' | 'red'
  assetKey: 'programs.private.cover' | 'programs.intensive.cover'
}

// Phase 3 deliberately removes Private Mentoring business/editorial runtime truth from this static module.
// Intensive Mentoring remains static until its own domain migration.
export const programEditorial = {
  'intensive-mentoring': {
    slug: 'intensive-mentoring',
    title: 'Intensive Mentoring',
    shortDescription: 'Pendampingan rutin dan terstruktur untuk mempersiapkan kompetisi bisnis dari tahap awal hingga final.',
    kicker: 'Bimbingan terstruktur dan berkelanjutan',
    detail: 'Bangun kesiapan kompetisimu melalui proses belajar yang berkesinambungan. Kuasai konsep inti, terapkan melalui tugas, sempurnakan hasil kerjamu, dan pantau perkembangan bersama mentor yang sama.',
    audience: 'Untuk siswa SMA dan mahasiswa: pemula, peserta kompetisi aktif atau berpengalaman, pengembang keterampilan, serta tim yang membutuhkan dukungan konsisten untuk mencapai tujuan bersama.',
    highlights: ['Satu mentor khusus', 'Rencana belajar yang disesuaikan', 'Persiapan kompetisi berkelanjutan'],
    journey: [
      { title: 'Penilaian awal', description: 'Kenali kelebihan, keterampilan yang perlu ditingkatkan, dan prioritas pengembanganmu.' },
      { title: 'Penetapan tujuan', description: 'Tentukan tujuan belajar, target kompetisi, dan hasil yang diharapkan.' },
      { title: 'Pengembangan terbimbing', description: 'Pelajari konsep, kerangka kerja, dan pendekatan bersama mentor khususmu.' },
      { title: 'Latihan dan penerapan', description: 'Terapkan pembelajaranmu melalui tugas, latihan kasus, atau karya untuk kompetisi.' },
      { title: 'Evaluasi dan penyempurnaan', description: 'Gunakan masukan untuk memperbaiki hasil kerja dan memperkuat bagian yang perlu dikembangkan.' },
      { title: 'Evaluasi akhir', description: 'Tinjau perkembangan, peningkatan utama, dan prioritas pengembangan selanjutnya.' },
    ],
    tone: 'red',
    assetKey: 'programs.intensive.cover',
  } satisfies ProgramEditorial,
}

export const mentoringProgramEditorial: ProgramEditorial[] = [programEditorial['intensive-mentoring']]

// Used only by the still-static Intensive Mentoring information page.
export const competitionCategories = [
  'Rencana Bisnis', 'Studi Kasus Bisnis', 'Esai Bisnis', 'Riset Ekuitas',
  'Karya Tulis Ilmiah', 'Pemasaran', 'Akuntansi dan Keuangan',
  'Presentasi Ide', 'Studi Kasus Ekonomi dan Kebijakan',
]

export function getProgramEditorialBySlug(slug: string): ProgramEditorial | null {
  return slug === 'intensive-mentoring' ? programEditorial['intensive-mentoring'] : null
}
