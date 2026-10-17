import { Quote } from 'lucide-react'

import { awardStyleFor } from '@/components/marketing/decor/award-tier'
import { NeoSticker } from '@/components/marketing/decor/decor-shapes'
import { FluentIcon } from '@/components/marketing/decor/fluent-icon'
import { cn } from '@/lib/utils'

// Shared pieces of every student-story surface (homepage testimonial dialog, About featured stories), so the
// placement chip and the quote mark look the same wherever a story is told. Styles live in app/home-stories.css.

/**
 * Placement chip. The visible text is the stored achievement, verbatim; awardStyleFor only picks the icon and
 * the tint (trophy for 1st/winner, medal for 2nd/3rd, sports medal otherwise).
 */
export function StoryAwardChip({ achievement, className }: { achievement: string; className?: string }) {
  const award = awardStyleFor(achievement)

  return (
    <NeoSticker
      className={cn('story-award', `story-award--${award.tier}`, className)}
      icon={<FluentIcon name={award.icon} size={26} />}
    >
      {achievement}
    </NeoSticker>
  )
}

/** Solid quote mark in an orange sticker disc; positioned by the card that owns it. */
export function StoryQuoteBadge({ className }: { className?: string }) {
  return (
    <span className={cn('story-quote-badge', className)} aria-hidden="true">
      <Quote fill="currentColor" strokeWidth={1.25} />
    </span>
  )
}
