import type { MentoringSlug } from './program-routes'

// Editorial source: the two English Strativate guidebooks, supplied 7 Sep 2026.
// Private Top Student 3-session total corrected by the owner to Rp855.000.
export const formatRupiah = (amount: number) => `Rp${new Intl.NumberFormat('id-ID').format(amount)}`

const sessionCounts = [1, 3, 5, 7, 10]
export const privateMentorTiers = [
  { name: 'Mentor Mahasiswa Berprestasi', description: 'Mahasiswa berprestasi yang berbagi strategi dari pengalaman langsung mengikuti kompetisi.', rates: [300000, 285000, 279000, 270000, 250000] },
  { name: 'Mentor Profesional Muda', description: 'Profesional industri yang membawa pengalaman bisnis dan sudut pandang dunia kerja.', rates: [350000, 335000, 329000, 320000, 300000] },
].map(tier => ({
  name: tier.name,
  description: tier.description,
  packages: sessionCounts.map((sessions, index) => ({ sessions, perSession: tier.rates[index], total: sessions * tier.rates[index] })),
}))

export const intensivePackages = [
  { name: 'Intensif', sessions: 4, price: 1150000, normalPrice: 1400000, description: 'Bimbingan mingguan yang memberi waktu untuk mencoba masukan sebelum sesi berikutnya.', features: ['Progres mingguan', 'Ulasan dan penyempurnaan rutin', 'Persiapan kompetisi yang konsisten'] },
  { name: 'Super Intensif', sessions: 8, price: 2200000, normalPrice: 2800000, description: 'Sesi lebih sering untuk mempercepat perkembangan dan mempersingkat siklus persiapan.', features: ['Mentoring dua kali seminggu', 'Siklus ulasan lebih cepat', 'Persiapan kompetisi intensif'] },
]

export const intensiveAddOns = [
  { name: 'Laporan Kinerja Terperinci', price: 150000, description: 'Evaluasi terstruktur untuk melihat kemampuan, progres, dan prioritas pengembanganmu.', features: ['Penilaian berbasis keterampilan', 'Kelebihan dan area perbaikan', 'Ringkasan progres', 'Rekomendasi mentor'] },
  { name: 'Simulasi Penjurian', price: 300000, description: 'Latih presentasi dan sesi tanya jawab dalam situasi kompetisi yang realistis bersama juri independen.', features: ['Simulasi presentasi dengan batas waktu', 'Tanya jawab bergaya kompetisi', 'Masukan dari juri independen', 'Skor kinerja berdasarkan rubrik'] },
  { name: 'Perlindungan Jaminan Kemenangan', price: 500000, description: 'Perlindungan tambahan bagi peserta yang memenuhi syarat berdasarkan target capaian kompetisi yang disepakati.', features: ['Target capaian yang disepakati', 'Penilaian kelayakan sesuai kompetisi', 'Perlindungan berupa pengembalian dana atau kredit program', 'Prioritas pemantauan perkembangan'], conditional: true },
]

export const intensiveBundles = [
  { name: 'Paket Rintisan Tim', price: 1250000, description: 'Untuk individu yang mengembangkan kemampuan dan mempersiapkan pembentukan tim kompetisi yang sesuai.', features: ['Paket Intensif', 'Laporan Kinerja Terperinci', 'Rencana mentoring yang disesuaikan', 'Dukungan persiapan kompetisi'] },
  { name: 'Paket Siap Kompetisi', price: 2500000, description: 'Untuk persiapan intensif, materi presentasi yang lebih kuat, dan latihan presentasi yang realistis.', features: ['Paket Super Intensif', 'Laporan Kinerja Terperinci', 'Simulasi Penjurian', 'Dukungan persiapan tahap akhir'] },
  { name: 'Paket Jaminan Kompetisi', price: 3000000, description: 'Untuk peserta yang memenuhi syarat dan mengejar target kompetisi tertentu dengan perlindungan tambahan.', features: ['Paket Super Intensif', 'Laporan Kinerja Terperinci', 'Simulasi Penjurian', 'Perlindungan Jaminan Kemenangan'], conditional: true },
]

export const guaranteeConditions = 'Syarat, ketentuan, dan penilaian kelayakan berlaku. Target capaian dan perlindungan disepakati setelah peninjauan sesuai kompetisi.'

export const competitionCategories = [
  'Rencana Bisnis', 'Studi Kasus Bisnis', 'Esai Bisnis', 'Riset Ekuitas',
  'Karya Tulis Ilmiah', 'Pemasaran', 'Akuntansi dan Keuangan',
  'Presentasi Ide', 'Studi Kasus Ekonomi dan Kebijakan',
]

export const privateLearningPaths = [
  { title: 'Belajar dari Dasar sampai Siap Tampil', description: 'Mulai dari memahami kompetisi, menemukan masalah, mengembangkan ide, menganalisis bisnis, menulis proposal, hingga presentasi. Cocok untuk kamu yang baru mulai.' },
  { title: 'Mentoring Fokus Kompetisi', description: 'Persiapkan satu kompetisi tertentu, mulai dari strategi kasus dan pengembangan proposal hingga simulasi presentasi, latihan tanya jawab, dan penyempurnaan akhir.' },
]

export const privateTopics = [
  { title: 'Perumusan Ide dan Masalah', description: 'Perjelas masalah, uji pemikiranmu, dan rumuskan solusi yang relevan.' },
  { title: 'Analisis Bisnis dan Penyusunan Kasus', description: 'Gunakan kerangka kerja, riset industri, dan analisis pesaing untuk memperkuat kasusmu.' },
  { title: 'Penulisan Proposal dan Alur Cerita', description: 'Susun ringkasan eksekutif yang jelas, alur yang logis, dan proposal bisnis yang meyakinkan.' },
  { title: 'Analisis Keuangan dan Valuasi', description: 'Pelajari model keuangan, valuasi, analisis investasi, serta asumsi yang mendasarinya.' },
  { title: 'Materi Presentasi dan Desain Visual', description: 'Tingkatkan struktur materi presentasi, visualisasi data, dan kejelasan penyampaian.' },
  { title: 'Keterampilan Presentasi dan Penyampaian Ide', description: 'Latih penyampaian, komunikasi, dan cara menjawab pertanyaan dengan percaya diri.' },
]

type ContentItem = { title: string; description: string }
export type ProgramInformation = {
  id: string; slug: MentoringSlug; title: string
  category: 'Private Mentoring' | 'Intensive Mentoring'; kicker: string
  description: string; detail: string; price: number; priceLabel: string; priceContext: string
  sessions: number; format: string; duration: string; tags: string[]; outcomes: string[]
  facts: string[]; audience: string; highlights: string[]; journey: ContentItem[]
  featured: true; informationOnly: true
}

export const mentoringPrograms: ProgramInformation[] = [
  {
    id: 'private-mentoring', slug: 'private-mentoring', title: 'Mentoring Privat', category: 'Private Mentoring',
    kicker: 'Sesi fleksibel dan terarah',
    description: 'Bimbingan terarah untuk tantangan, hasil kerja, atau tahap kompetisi tertentu. Pilih topik, mentor, dan jumlah sesi sesuai kebutuhanmu.',
    detail: 'Mulai dengan satu sesi terarah dan lanjutkan sesuai kebutuhan. Perkuat dasar pengetahuan, pertajam proposal, tingkatkan analisis, atau latih presentasimu dengan masukan praktis sesuai tujuanmu.',
    price: privateMentorTiers[0].packages[0].total,
    priceLabel: `Mulai ${formatRupiah(privateMentorTiers[0].packages[0].total)}`,
    priceContext: 'Paket 1 sesi · harga sama untuk 1–4 peserta',
    sessions: 1, format: 'Daring · sesi 75 menit', duration: 'Jadwal fleksibel',
    tags: ['Per sesi', 'Individu atau tim', 'Persiapan kompetisi'], featured: true, informationOnly: true,
    audience: 'Untuk pemula yang belajar dari dasar, individu atau tim yang bersiap mengikuti kompetisi, serta peserta yang membutuhkan evaluasi atau latihan terarah.',
    highlights: ['75 menit per sesi', 'Individu atau tim berisi 1–4 orang', 'Pilih mentormu'],
    facts: ['75 menit per sesi', 'Individu atau tim berisi 1–4 peserta', 'Mentor Mahasiswa Berprestasi atau Profesional Muda', 'Paket 1, 3, 5, 7, atau 10 sesi'],
    outcomes: ['Koneksi langsung dengan mentor dan wawasan praktis', 'Diskusi strategi kompetisi dan masukan yang dapat diterapkan', 'Perspektif juri dari mentor yang berpengalaman dalam penjurian', 'Referensi contoh materi presentasi bila sesuai', 'Kesempatan diskusi dalam grup bersama mentor untuk paket 5 sesi atau lebih', 'Latihan singkat atau kasus simulasi sesuai kesepakatan'],
    journey: [
      { title: 'Konsultasi awal', description: 'Ceritakan tujuan, perkembangan, materi, dan bagian yang membutuhkan dukungan.' },
      { title: 'Pemilihan mentor dan perencanaan', description: 'Temukan mentor yang tepat dan tentukan agenda sesi yang terarah.' },
      { title: 'Sesi mentoring langsung', description: 'Gunakan 75 menit interaktif untuk berdiskusi, menganalisis, dan menyelesaikan tantanganmu.' },
      { title: 'Rencana tindakan dan langkah berikutnya', description: 'Dapatkan prioritas tindakan, sumber belajar yang bermanfaat, dan saran topik lanjutan bila diperlukan.' },
    ],
  },
  {
    id: 'intensive-mentoring', slug: 'intensive-mentoring', title: 'Mentoring Intensif', category: 'Intensive Mentoring',
    kicker: 'Bimbingan terstruktur dan berkelanjutan',
    description: 'Persiapkan diri secara sistematis bersama mentor khusus, rencana belajar yang disesuaikan, masukan rutin, dan perkembangan terukur sepanjang persiapan.',
    detail: 'Bangun kesiapan kompetisimu melalui proses belajar yang berkesinambungan. Kuasai konsep inti, terapkan melalui tugas, sempurnakan hasil kerjamu, dan pantau perkembangan bersama mentor yang sama.',
    price: intensivePackages[0].price, priceLabel: `Mulai ${formatRupiah(intensivePackages[0].price)}`,
    priceContext: 'Paket Intensif · 4 sesi per bulan',
    sessions: 4, format: 'Mentoring rutin mingguan', duration: '4 atau 8 sesi per bulan',
    tags: ['Mentor khusus', 'Rencana belajar terstruktur', 'Persiapan kompetisi'], featured: true, informationOnly: true,
    audience: 'Untuk siswa SMA dan mahasiswa: pemula, peserta kompetisi aktif atau berpengalaman, pengembang keterampilan, serta tim yang membutuhkan dukungan konsisten untuk mencapai tujuan bersama.',
    highlights: ['4 atau 8 sesi per bulan', 'Satu mentor khusus', 'Rencana belajar yang disesuaikan'],
    facts: ['4 atau 8 sesi per bulan untuk kompetisi nasional', 'Mentor yang sama sepanjang program', 'Rencana belajar yang disesuaikan dan tugas dengan bimbingan', 'Dukungan yang disesuaikan untuk kompetisi internasional'],
    outcomes: ['Mentor khusus dan rencana belajar yang disesuaikan', 'Konsep inti dan kerangka kerja praktis', 'Tugas praktik untuk menghasilkan karya nyata', 'Masukan dan penyempurnaan berkelanjutan', 'Rekomendasi kompetisi dan jadwal persiapan', 'Templat, contoh proposal, dan referensi materi presentasi', 'Pemantauan perkembangan dan evaluasi akhir'],
    journey: [
      { title: 'Penilaian awal', description: 'Kenali kelebihan, keterampilan yang perlu ditingkatkan, dan prioritas pengembanganmu.' },
      { title: 'Penetapan tujuan', description: 'Tentukan tujuan belajar, target kompetisi, dan hasil yang diharapkan.' },
      { title: 'Pengembangan terbimbing', description: 'Pelajari konsep, kerangka kerja, dan pendekatan bersama mentor khususmu.' },
      { title: 'Latihan dan penerapan', description: 'Terapkan pembelajaranmu melalui tugas, latihan kasus, atau karya untuk kompetisi.' },
      { title: 'Evaluasi dan penyempurnaan', description: 'Gunakan masukan untuk memperbaiki hasil kerja dan memperkuat bagian yang perlu dikembangkan.' },
      { title: 'Evaluasi akhir', description: 'Tinjau perkembangan, peningkatan utama, dan prioritas pengembangan selanjutnya.' },
    ],
  },
]

export const getProgramInformation = (slug: string) => mentoringPrograms.find(program => program.slug === slug)
