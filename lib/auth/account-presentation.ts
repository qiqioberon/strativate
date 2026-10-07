import { formError } from './errors'

export type AccountLanguage = 'id' | 'en'

const englishMessages: Record<string, string> = {
  'Kata sandi wajib diisi.': 'Enter a password.',
  'Isi kata sandi terlebih dahulu.': 'Enter your password first.',
  'Gunakan kata sandi minimal 8 karakter.': 'Use at least 8 characters.',
  'Kata sandi maksimal 128 karakter.': 'Use no more than 128 characters.',
  'Gunakan setidaknya 1 huruf kapital.': 'Include at least one uppercase letter.',
  'Gunakan setidaknya 1 angka.': 'Include at least one number.',
  'Gunakan setidaknya 1 simbol.': 'Include at least one symbol.',
  'Konfirmasi kata sandi tidak sama.': 'The passwords do not match.',
  'Nama pengguna harus 3–30 karakter, menggunakan huruf, angka, atau garis bawah.': 'Use 3–30 letters, numbers, or underscores for your username.',
  'Gunakan nomor WhatsApp Indonesia, misalnya 08123456789, 628123456789, atau +628123456789.': 'Use an Indonesian WhatsApp number, such as 08123456789, 628123456789, or +628123456789.',
  'Masukkan kode verifikasi dari email.': 'Enter the verification code from your email.',
  'Format foto harus JPG, PNG, atau WebP.': 'Choose a JPG, PNG, or WebP photo.',
  'Ukuran foto maksimal 8 MB.': 'Choose a photo no larger than 8 MB.',
  'Area crop tidak valid.': 'The crop is invalid. Adjust it and try again.',
  'Sumber asli foto tidak tersedia. Unggah foto pengganti.': 'The original photo is unavailable. Upload a replacement.',
  'Sumber asli foto profil tidak tersedia.': 'The original profile photo is unavailable.',
  'Resolusi foto tidak valid.': 'The photo resolution is invalid. Choose another photo.',
  'Area crop minimal 128×128 px.': 'Select a crop of at least 128 × 128 pixels.',
  'Area crop harus berbentuk persegi.': 'Use a square crop.',
  'Foto profil belum dapat disimpan.': 'Your photo could not be saved. Try again.',
  'Foto profil belum dapat diproses. Coba file lain atau ulangi beberapa saat lagi.': 'Your photo could not be processed. Choose another file or try again later.',
  'Foto tersimpan, tetapi file lama masih perlu dibersihkan.': 'Your photo was saved.',
  'Foto tersimpan; respons penyimpanan awal tidak dapat dikonfirmasi.': 'Your photo was saved. Refresh to see the change.',
  'Unauthorized': 'Your session has expired. Sign in again.',
  'Avatar not found': 'Your profile photo is unavailable.',
  'Enter a valid name and username': 'Check your name and username.',
}

/** Keep validation rules and server responses unchanged; localize their visible copy. */
export function accountMessage(message: string, language: AccountLanguage, fallback: string) {
  return language === 'en' ? englishMessages[message] ?? fallback : message
}

export function accountFormError(error: unknown, language: AccountLanguage, fallbackId: string, fallbackEn: string) {
  if (language === 'id') return formError(error, fallbackId)
  if (!error || typeof error !== 'object') return fallbackEn
  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''
  const byCode: Record<string, string> = {
    '23505': 'This username is already in use. Choose another one.',
    weak_password: 'Use a stronger password that meets the requirements.',
    same_password: 'Choose a password different from your current password.',
    invalid_credentials: 'The email or password is incorrect.',
    over_email_send_rate_limit: 'Too many attempts. Wait a moment before trying again.',
    over_request_rate_limit: 'Too many attempts. Wait a moment before trying again.',
    '42501': 'Your session or permissions have changed. Sign in again.',
    PGRST301: 'Your session has expired. Sign in again.',
    reauth_nonce_invalid: 'The verification code is invalid or has expired. Start the password change again.',
    otp_expired: 'The verification code has expired. Request a new code.',
  }
  if (byCode[code]) return byCode[code]
  const validationMessage = code === 'P0001' && message.startsWith('VALIDATION:') ? message.slice(11).trim() : message
  return englishMessages[validationMessage] ?? fallbackEn
}
