'use client'

import { ArrowRight, CircleHelp, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { faqPreview } from '@/lib/content/marketing-content'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import { cn } from '@/lib/utils'

type FaqCategory = (typeof faqPreview)[number]['category']
type FaqFilter = 'Semua' | FaqCategory

const categories: FaqFilter[] = ['Semua', ...Array.from(new Set(faqPreview.map((item) => item.category)))]

function testId(value: string) {
  return value.toLocaleLowerCase('id').replaceAll(' ', '-')
}

export function FaqDirectory() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FaqFilter>('Semua')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('id')
    return faqPreview.filter((item) => {
      const matchesCategory = category === 'Semua' || item.category === category
      const searchable = `${item.question} ${item.answer}`.toLocaleLowerCase('id')
      return matchesCategory && (!normalized || searchable.includes(normalized))
    })
  }, [category, query])

  return (
    <div className="marketing-container marketing-faq-directory">
      <aside className="marketing-faq-directory__aside" data-testid="faq-support-panel">
        <CircleHelp aria-hidden="true" size={30} />
        <strong data-testid="faq-support-title">Masih punya pertanyaan? Sampaikan kebutuhanmu langsung kepada tim Strativate.</strong>
        <a href={buildWhatsAppHref('Halo Strativate, saya masih memiliki pertanyaan dan ingin berkonsultasi.')} target="_blank" rel="noreferrer" data-testid="faq-whatsapp-link">Tanya via WhatsApp <ArrowRight aria-hidden="true" size={16} /></a>
      </aside>

      <div>
        <div className="marketing-faq-toolbar" data-testid="faq-filter-toolbar">
          <label className="marketing-faq-search">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Cari pertanyaan</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari pertanyaan" data-testid="faq-search-input" />
          </label>
          <div className="marketing-faq-filters" aria-label="Filter kategori pertanyaan">
            {categories.map((option) => (
              <button
                className={cn(category === option && 'is-active')}
                type="button"
                aria-pressed={category === option}
                onClick={() => setCategory(option)}
                key={option}
                data-testid={`faq-category-${testId(option)}-button`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <p className="marketing-faq-result" aria-live="polite" data-testid="faq-result-count">Menampilkan {filtered.length} jawaban</p>
        {filtered.length ? (
          <div className="marketing-faq-list" data-testid="faq-list">
            {filtered.map((item, index) => (
              <details key={item.question} open={index === 0} data-testid={`faq-item-${index + 1}`}>
                <summary data-testid={`faq-summary-${index + 1}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><small>{item.category}</small><strong>{item.question}</strong></div>
                  <ArrowRight aria-hidden="true" size={18} />
                </summary>
                <p data-testid={`faq-answer-${index + 1}`}>{item.answer}</p>
              </details>
            ))}
          </div>
        ) : (
          <div className="marketing-faq-empty" data-testid="faq-empty-state">
            <strong>Tidak ada jawaban yang cocok.</strong>
            <p>Coba kata kunci lain atau tanyakan langsung melalui WhatsApp.</p>
          </div>
        )}
      </div>
    </div>
  )
}
