export type PrivateMentoringPackageDraft = {
  priceAmount: number
  referencePriceAmount: number | null
  durationMinutes: number
  maxParticipants: number
  sortOrder: number
}

export function validatePrivateMentoringPackageDraft(draft: PrivateMentoringPackageDraft) {
  if (!Number.isSafeInteger(draft.priceAmount) || draft.priceAmount <= 0) return 'Harga paket harus bilangan bulat positif.'
  if (draft.referencePriceAmount !== null && (!Number.isSafeInteger(draft.referencePriceAmount) || draft.referencePriceAmount < draft.priceAmount)) return 'Harga referensi harus kosong atau setidaknya sebesar harga aktif.'
  if (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 1 || draft.durationMinutes > 480) return 'Durasi sesi harus 1–480 menit.'
  if (!Number.isInteger(draft.maxParticipants) || draft.maxParticipants < 1 || draft.maxParticipants > 100) return 'Jumlah peserta harus 1–100.'
  if (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0) return 'Urutan harus bilangan bulat non-negatif.'
  return null
}
