'use client'

import { ArrowRight, CircleHelp, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { faqPreview } from '@/lib/content/marketing-content'
import { buildWhatsAppHref } from '@/lib/marketing/whatsapp'
import { cn } from '@/lib/utils'

type FaqCategory = (typeof faqPreview)[number]['category']
type FaqFilter = 'All' | FaqCategory

const categories: FaqFilter[] = ['All', ...Array.from(new Set(faqPreview.map((item) => item.category)))]

function testId(value: string) {
  return value.toLocaleLowerCase('en').replaceAll(' ', '-')
}

export function FaqDirectory() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FaqFilter>('All')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('en')
    return faqPreview.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category
      const searchable = `${item.question} ${item.answer}`.toLocaleLowerCase('en')
      return matchesCategory && (!normalized || searchable.includes(normalized))
    })
  }, [category, query])

  return (
    <div className="marketing-container marketing-faq-directory">
      <aside className="marketing-faq-directory__aside" data-testid="faq-support-panel">
        <CircleHelp aria-hidden="true" size={30} />
        <strong data-testid="faq-support-title">Still have a question? Share it directly with the Strativate team.</strong>
        <a href={buildWhatsAppHref('Hello Strativate, I have a question and would like some help.')} target="_blank" rel="noreferrer" data-testid="faq-whatsapp-link">Ask on WhatsApp <ArrowRight aria-hidden="true" size={16} /></a>
      </aside>

      <div>
        <div className="marketing-faq-toolbar" data-testid="faq-filter-toolbar">
          <label className="marketing-faq-search">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Search questions</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions" data-testid="faq-search-input" />
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

        <p className="marketing-faq-result" aria-live="polite" data-testid="faq-result-count">Showing {filtered.length} answers</p>
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
            <strong>No answers match your search.</strong>
            <p>Try another keyword or ask the Strativate team on WhatsApp.</p>
          </div>
        )}
      </div>
    </div>
  )
}
