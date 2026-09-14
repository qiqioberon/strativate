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

export const programEditorial: Record<MentoringSlug, ProgramEditorial> = {
  'private-mentoring': {
    slug: 'private-mentoring',
    title: 'Private Mentoring',
    shortDescription: 'Mentoring fleksibel untuk individu atau tim kecil yang disesuaikan dengan kebutuhan, target, dan timeline peserta.',
    kicker: 'Sesi fleksibel dan terarah',
    detail: 'Mulai dengan satu sesi terarah dan lanjutkan sesuai kebutuhan. Perkuat dasar pengetahuan, pertajam proposal, tingkatkan analisis, atau latih presentasimu dengan masukan praktis sesuai tujuanmu.',
    audience: 'Untuk pemula yang belajar dari dasar, individu atau tim yang bersiap mengikuti kompetisi, serta peserta yang membutuhkan evaluasi atau latihan terarah.',
    highlights: ['Pilih fokus sesuai kebutuhan', 'Belajar bersama mentor pilihan', 'Persiapan individu atau tim'],
    journey: [
      { title: 'Konsultasi awal', description: 'Ceritakan tujuan, perkembangan, materi, dan bagian yang membutuhkan dukungan.' },
      { title: 'Pemilihan mentor dan perencanaan', description: 'Temukan mentor yang tepat dan tentukan agenda sesi yang terarah.' },
      { title: 'Sesi mentoring langsung', description: 'Gunakan waktu interaktif untuk berdiskusi, menganalisis, dan menyelesaikan tantanganmu.' },
      { title: 'Rencana tindakan dan langkah berikutnya', description: 'Dapatkan prioritas tindakan, sumber belajar yang bermanfaat, dan saran topik lanjutan bila diperlukan.' },
    ],
    tone: 'orange',
    assetKey: 'programs.private.cover',
  },
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
  },
}

export const mentoringProgramEditorial = Object.values(programEditorial)

export const competitionCategories = [
  'Rencana Bisnis', 'Studi Kasus Bisnis', 'Esai Bisnis', 'Riset Ekuitas',
  'Karya Tulis Ilmiah', 'Pemasaran', 'Akuntansi dan Keuangan',
  'Presentasi Ide', 'Studi Kasus Ekonomi dan Kebijakan',
]

export function getProgramEditorialBySlug(slug: string): ProgramEditorial | null {
  return Object.hasOwn(programEditorial, slug)
    ? programEditorial[slug as MentoringSlug]
    : null
}
