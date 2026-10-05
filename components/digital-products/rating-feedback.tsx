'use client'

import { CheckCircle2, LoaderCircle, MessageSquareText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DigitalProductReview } from '@/lib/supabase/database.types'
import { PeekRating } from './peek-rating'

export function RatingFeedback({ productId, productName }: { productId: string; productName: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [review, setReview] = useState<DigitalProductReview | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { let active = true; async function load() { const { data, error: loadError } = await supabase.rpc('get_my_digital_product_review', { p_product_id: productId }); if (!active) return; const current = data?.[0] ?? null; setReview(current); setRating(current?.rating ?? 0); setComment(current?.comment ?? ''); if (loadError) setError('Feedback belum dapat dimuat.'); setLoading(false) }; void load(); return () => { active = false } }, [productId, supabase])
  async function save(event: React.FormEvent) { event.preventDefault(); if (saving || rating < 1) return; setSaving(true); setMessage(''); setError(''); const { data, error: saveError } = await supabase.rpc('submit_digital_product_review', { p_product_id: productId, p_rating: rating, p_comment: comment.trim() || null }); if (saveError) setError(saveError.message.includes('ownership') ? 'Feedback hanya dapat dikirim oleh pemilik produk yang sudah membayar.' : 'Feedback belum dapat disimpan. Coba lagi.'); else { setReview(data); setComment(data.comment ?? ''); setMessage('Feedback Anda sudah tersimpan.'); } setSaving(false) }
  if (loading) return <section className="digital-product-rating-card" aria-busy="true"><LoaderCircle className="is-spinning" aria-hidden="true" size={20}/><span>Memuat feedback Anda…</span></section>
  return <section className="digital-product-rating-card" aria-labelledby="product-rating-heading">
    <div className="digital-product-rating-card__heading"><div><h2 id="product-rating-heading">{review ? 'Your rating' : 'Rate this product'}</h2><p>{review ? `Update your feedback for ${productName} any time.` : 'Help us improve this resource with a quick rating or comment.'}</p></div><MessageSquareText aria-hidden="true"/></div>
    <form onSubmit={save} className="digital-product-rating-form"><label className="digital-product-rating-form__label">{review ? 'Your rating' : 'Choose a rating'}<PeekRating value={rating} onChange={setRating} ariaLabel={`Rate ${productName} from 1 to 5 stars`}/></label><label className="digital-product-rating-form__comment">Tell us what you think <span>(optional)</span><textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} rows={4} placeholder="What was useful? What could be clearer?"/><small>{comment.length}/2000 · Comments are read by the Strativate team.</small></label><div className="digital-product-rating-form__actions"><button className="button button-primary" disabled={saving || rating < 1}>{saving ? <><LoaderCircle className="is-spinning" size={15}/> Saving…</> : review ? 'Update feedback' : 'Submit feedback'}</button>{message ? <span className="digital-product-feedback-success" role="status"><CheckCircle2 size={15}/> {message}</span> : null}</div>{error ? <p className="digital-product-feedback-error" role="alert">{error}</p> : null}</form>
  </section>
}
