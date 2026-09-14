const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  currencyDisplay: 'symbol',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

export function formatRupiah(amount: number) {
  if (!Number.isSafeInteger(amount)) throw new Error('Rupiah amount must be a safe integer.')
  if (amount < 0) throw new Error('Rupiah amount must be non-negative.')
  return rupiah.format(amount).replace(/\s/g, '')
}
