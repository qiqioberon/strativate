import Image from 'next/image'
import { X } from 'lucide-react'

import { awardStyleFor } from '@/components/marketing/decor/award-tier'
import { BrandOrnament } from '@/components/marketing/decor/brand-ornament'
import { DecorRing, DecorSparkle, NeoBurst, NeoSticker } from '@/components/marketing/decor/decor-shapes'
import { FluentIcon } from '@/components/marketing/decor/fluent-icon'
import { ParallaxLayer } from '@/components/marketing/decor/parallax-layer'
import { TiltSurface } from '@/components/marketing/decor/tilt-surface'
import { StoryAwardChip, StoryQuoteBadge } from '@/components/marketing/story-details'
import type { MarketingTestimonialView } from '@/lib/marketing/testimonial-types'

/**
 * Contents of the homepage testimonial <dialog>: a warm brand stage that shows the story photo as a tilted
 * print (whole photo visible), and a reading column with the competition, the placement chip and the quote.
 * Every visible fact is the stored testimonial record; all decoration is aria-hidden. The close button comes
 * first so native showModal() focuses it.
 */
export function StoryDialogPanel({ story, onClose }: { story: MarketingTestimonialView; onClose: () => void }) {
  const award = awardStyleFor(story.achievement)

  return (
    <div className="marketing-testimonial-dialog__panel story-dialog">
      <button type="button" className="marketing-testimonial-dialog__close" onClick={onClose} aria-label="Close testimonial">
        <X aria-hidden="true" size={20} strokeWidth={2.5} />
      </button>

      <div className="story-dialog__stage">
        <ParallaxLayer className="story-dialog__decor">
          <DecorRing className="story-dialog__ring" motion="spin" depth={0.2} />
          <BrandOrnament name="torus-orange" className="story-dialog__torus" far depth={0.7} delay={-2.4} duration={7} eager />
          <DecorSparkle className="story-dialog__sparkle story-dialog__sparkle--a" motion="twinkle" depth={0.9} />
          <DecorSparkle className="story-dialog__sparkle story-dialog__sparkle--b" motion="twinkle" delay={-1.8} depth={1.1} />
        </ParallaxLayer>

        <div className="story-dialog__print-wrap">
          <BrandOrnament name="coil-amber" className="story-dialog__coil" depth={0} delay={-1.2} duration={7} eager />
          <TiltSurface className="story-dialog__print" maxTilt={6}>
            <div className="marketing-testimonial-dialog__media">
              <Image src={story.imageUrl} alt={story.altText} fill sizes="(max-width: 719px) 84vw, 420px" unoptimized />
            </div>
          </TiltSurface>
          <span className="story-dialog__seal" aria-hidden="true">
            <NeoBurst spin>
              <FluentIcon name={award.icon} size={48} />
            </NeoBurst>
          </span>
        </div>
      </div>

      <div className="marketing-testimonial-dialog__content story-dialog__content">
        <NeoSticker as="p" tone="white" className="story-dialog__label" icon={<FluentIcon name="graduation-cap" size={24} />}>
          Student stories
        </NeoSticker>
        <h2 id="testimonial-dialog-title">{story.competition_name}</h2>
        <StoryAwardChip achievement={story.achievement} className="marketing-testimonial-dialog__achievement" />
        <div className="story-quote">
          <StoryQuoteBadge className="story-quote__badge" />
          <blockquote>{story.testimonial}</blockquote>
        </div>
      </div>
    </div>
  )
}
