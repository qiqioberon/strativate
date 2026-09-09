'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CreditCard } from 'lucide-react'
import type { LegacyCheckoutCatalogItem } from '@/lib/catalog/compatibility'
import { completePurchase, createPendingOrder, readState, writeState, type ProgramKind } from '@/lib/demo-store'

function demoKind(item: LegacyCheckoutCatalogItem): ProgramKind {
  if (item.productType === 'digital_product') return 'Digital Product'
  if (item.productType === 'big_class') return 'Big Class'
  if (item.productType === 'intensive_mentoring') return 'Intensive Mentoring'
  return 'Private Mentoring'
}

export function LegacyCheckout({ item }: { item: LegacyCheckoutCatalogItem }) {
  const [step, setStep] = useState<'review' | 'success'>('review')
  const pay = () => {
    const pending = createPendingOrder({
      type: demoKind(item), title: item.title, productId: item.productId, commercialItemId: item.commercialItemId,
      subject: item.title, price: item.priceLabel, amount: item.priceAmount, sessions: 0,
      packageLabel: 'Pilihan katalog',
    })
    writeState(completePurchase(readState(), pending, 'QRIS'))
    setStep('success')
  }

  if (step === 'success') return <main className="checkout-page success-page"><div className="success-mark"><Check size={28} /></div><p className="kicker">PEMBELIAN TERCATAT</p><h1>Semua sudah siap.<br /><em>Lanjutkan persiapanmu.</em></h1><p>Pembelian {item.title} sudah terhubung ke akun Strativate milikmu.</p><div className="success-actions"><Link href="/dashboard" className="primary-cta">Buka program saya <ArrowRight size={16} /></Link><Link href="/explore" className="secondary-cta">Lihat program lain</Link></div></main>

  return <main className="checkout-page"><Link href={`/program/${item.slug}`} className="back-link"><ArrowLeft size={15} /> Kembali ke program</Link><div className="checkout-head"><p className="kicker">PEMBAYARAN / TINJAUAN</p><h1>{item.title}</h1></div><section className="review-card"><div><p className="kicker">TINJAUAN PESANAN</p><h2>Apakah semuanya sudah sesuai?</h2><p>Simulasi ini menggunakan identitas pilihan katalog {item.commercialItemId}.</p></div><div className="checkout-total"><span>Total pembayaran</span><strong>{item.priceLabel}</strong></div><button className="primary-cta full" onClick={pay}><CreditCard size={16} /> Bayar dengan QRIS</button></section></main>
}
