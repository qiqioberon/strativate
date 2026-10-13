import { ChevronDown } from 'lucide-react'

import { faqPreview } from '@/lib/content/marketing-content'

export function FaqDirectory() {
  return (
    <div className="program-faq__list" data-testid="faq-list">
      {faqPreview.map((item, index) => (
        <details key={item.question} data-testid={`faq-item-${index + 1}`}>
          <summary data-testid={`faq-summary-${index + 1}`}>
            <span>{item.question}</span>
            <span className="program-faq__toggle" aria-hidden="true"><ChevronDown size={20} /></span>
          </summary>
          <p data-testid={`faq-answer-${index + 1}`}>{item.answer}</p>
        </details>
      ))}
    </div>
  )
}
