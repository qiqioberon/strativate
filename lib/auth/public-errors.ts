import { formError } from './errors'
import { passwordError, usernameError } from './rules'

// Public auth translates the shared helpers without changing internal forms.
const publicMessages: Record<string, string> = {
  'Data sudah digunakan. Untuk nama pengguna, coba nama lain.': 'These details are already in use. Try a different username.',
  'Kata sandi belum memenuhi kebijakan keamanan. Gunakan kata sandi yang lebih kuat.': 'Your password does not meet the security requirements. Choose a stronger password.',
  'Kata sandi baru sama dengan kata sandi akun saat ini. Gunakan kata sandi lain jika ingin mengubahnya.': 'Your new password matches your current password. Choose a different password to change it.',
  'Email atau kata sandi tidak sesuai.': 'The email or password is incorrect.',
  'Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.': 'Too many attempts. Please wait a moment before trying again.',
  'Sesi atau izin tidak sesuai. Silakan masuk kembali.': 'Your session or permissions are no longer valid. Please sign in again.',
  'Periksa nama dan format nama pengguna.': 'Check your name and username format.',
  'Tetapkan kata sandi akun terlebih dahulu.': 'Set your account password first.',
  'Lengkapi langkah sebelumnya terlebih dahulu.': 'Complete the previous steps first.',
  'Kata sandi wajib diisi.': 'Enter a password.',
  'Isi kata sandi terlebih dahulu.': 'Enter your password first.',
  'Gunakan kata sandi minimal 8 karakter.': 'Use a password with at least 8 characters.',
  'Kata sandi maksimal 128 karakter.': 'Your password must be no more than 128 characters.',
  'Gunakan setidaknya 1 huruf kapital.': 'Include at least one uppercase letter.',
  'Gunakan setidaknya 1 angka.': 'Include at least one number.',
  'Gunakan setidaknya 1 simbol.': 'Include at least one symbol.',
  'Konfirmasi kata sandi tidak sama.': 'Your passwords do not match.',
  'Nama pengguna harus 3–30 karakter, menggunakan huruf, angka, atau garis bawah.': 'Your username must be 3–30 characters and contain only letters, numbers, or underscores.',
}

export function authFormError(error: unknown, fallback = 'The request failed. Check your connection and try again.'): string {
  const message = formError(error, fallback)
  return publicMessages[message] || fallback
}

export function authPasswordError(password: string, confirmation: string, required: boolean): string | null {
  const message = passwordError(password, confirmation, required)
  return message ? publicMessages[message] || 'Check your password and confirmation.' : null
}

export function authUsernameError(username: string): string | null {
  const message = usernameError(username)
  return message ? publicMessages[message] || 'Enter a valid username.' : null
}
