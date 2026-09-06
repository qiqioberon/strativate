export function formError(error: unknown, fallback = 'Permintaan gagal. Periksa koneksi dan coba lagi.'): string {
  if (!error || typeof error !== 'object') return fallback
  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''
  if (code === '23505') return 'Data sudah digunakan. Untuk username, coba nama lain.'
  if (code === 'weak_password') return 'Password belum memenuhi kebijakan keamanan. Gunakan password yang lebih kuat.'
  if (code === 'same_password') return 'Password ini sudah digunakan. Masukkan password yang berbeda.'
  if (code === 'invalid_credentials') return 'Email atau password tidak sesuai.'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.'
  if (code === '42501' || code === 'PGRST301') return 'Sesi atau izin tidak sesuai. Silakan masuk kembali.'
  if (code === '22023') {
    const messages: Record<string, string> = {
      'Enter a valid name and username': 'Periksa nama dan format username.',
      'Set your account password first': 'Tetapkan password akun terlebih dahulu.',
      'Complete preceding steps first': 'Lengkapi langkah sebelumnya terlebih dahulu.',
      'Select an available institution': 'Pilih institusi yang tersedia atau ajukan institusi baru.',
      'Enter a valid cohort year': 'Masukkan tahun angkatan yang valid.',
      'Choose exactly one referral response': 'Pilih satu sumber referral atau isi Lainnya.',
      'Select an active referral source': 'Opsi referral sudah tidak aktif. Pilih opsi lain.',
      'Select active interests': 'Salah satu minat sudah tidak aktif. Pilih kembali minatmu.',
      'Select at least one interest': 'Pilih minimal satu minat atau isi Lainnya.',
    }
    return messages[message] || 'Data belum valid. Periksa isian dan pilihanmu, lalu coba lagi.'
  }
  if (code === 'P0001' && message.startsWith('VALIDATION:')) return message.slice(11).trim()
  return fallback
}
