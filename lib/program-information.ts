// Konten editorial ini melengkapi Product Master. Identitas, label operasional,
// urutan, struktur komersial, dan harga tidak boleh didefinisikan di sini.
type ContentItem = { title: string; description: string }

export type ProgramEditorial = {
  productCode: 'private_mentoring' | 'intensive_mentoring'
  kicker: string
  detail: string
  audience: string
  highlights: string[]
  journey: ContentItem[]
}

export const programEditorial: Record<ProgramEditorial['productCode'], ProgramEditorial> = {
  private_mentoring: {
    productCode: 'private_mentoring',
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
  },
  intensive_mentoring: {
    productCode: 'intensive_mentoring',
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
  },
}

export const deliveryOptionEditorial: Record<string, { description: string }> = {
  end_to_end_learning: { description: 'Mulai dari memahami kompetisi, menemukan masalah, mengembangkan ide, menganalisis bisnis, menulis proposal, hingga presentasi.' },
  competition_focused: { description: 'Persiapkan satu kompetisi tertentu, dari strategi kasus dan pengembangan proposal hingga simulasi presentasi dan penyempurnaan akhir.' },
  idea_problem_framing: { description: 'Perjelas masalah, uji pemikiranmu, dan rumuskan solusi yang relevan.' },
  business_analysis_case_structuring: { description: 'Gunakan kerangka kerja, riset industri, dan analisis pesaing untuk memperkuat kasusmu.' },
  proposal_writing_storyline: { description: 'Susun ringkasan eksekutif, alur yang logis, dan proposal bisnis yang meyakinkan.' },
  financial_analysis_valuation: { description: 'Pelajari model keuangan, valuasi, analisis investasi, serta asumsi yang mendasarinya.' },
  slide_deck_visual_design: { description: 'Tingkatkan struktur materi presentasi, visualisasi data, dan kejelasan penyampaian.' },
  pitching_presentation_skills: { description: 'Latih penyampaian, komunikasi, dan cara menjawab pertanyaan dengan percaya diri.' },
  custom_topic: { description: 'Diskusikan kebutuhan khususmu saat konsultasi agar fokus sesi tetap terarah.' },
}

export const commercialItemEditorial: Record<string, { description: string }> = {
  intensive_national: { description: 'Bimbingan mingguan yang memberi waktu untuk mencoba masukan sebelum sesi berikutnya.' },
  super_intensive_national: { description: 'Sesi lebih sering untuk mempercepat perkembangan dan mempersingkat siklus persiapan.' },
  international_custom: { description: 'Rencana mentoring disusun setelah konsultasi awal sesuai kebutuhan kompetisi internasional.' },
  detailed_performance_report: { description: 'Evaluasi terstruktur untuk melihat kemampuan, progres, dan prioritas pengembanganmu.' },
  mock_judging_simulation: { description: 'Latih presentasi dan sesi tanya jawab dalam situasi kompetisi yang realistis bersama juri independen.' },
  win_guarantee_protection: { description: 'Perlindungan tambahan bagi peserta yang memenuhi syarat berdasarkan target capaian kompetisi yang disepakati.' },
  team_starter_bundle: { description: 'Untuk individu yang mengembangkan kemampuan dan mempersiapkan pembentukan tim kompetisi yang sesuai.' },
  competition_ready_bundle: { description: 'Untuk persiapan intensif, materi presentasi yang lebih kuat, dan latihan presentasi yang realistis.' },
  competition_assurance_bundle: { description: 'Untuk peserta yang memenuhi syarat dan mengejar target kompetisi tertentu dengan perlindungan tambahan.' },
}

export const competitionCategories = [
  'Rencana Bisnis', 'Studi Kasus Bisnis', 'Esai Bisnis', 'Riset Ekuitas',
  'Karya Tulis Ilmiah', 'Pemasaran', 'Akuntansi dan Keuangan',
  'Presentasi Ide', 'Studi Kasus Ekonomi dan Kebijakan',
]

export function getProgramEditorial(productCode: string): ProgramEditorial | null {
  return productCode in programEditorial
    ? programEditorial[productCode as ProgramEditorial['productCode']]
    : null
}
