import type { CSSProperties } from 'react'

import { BrandOrnament } from './decor/brand-ornament'
import { DecorRing, DecorSparkle, NeoSpeechBubble } from './decor/decor-shapes'
import { FluentIcon } from './decor/fluent-icon'
import { ParallaxLayer } from './decor/parallax-layer'

/**
 * FAQ decoration, split in two layers so every piece stays anchored to the layout. All of it is aria-hidden,
 * pointer-events none and sits behind the question boxes; placement lives in app/home-faq-decor.css.
 */

/** Inside the heading row: a speech bubble perched on the "FAQ" title, a sparkle and a dot field that fills
 *  the empty run between the title and the "See all questions" pill. Sized in em so it scales with the h2. */
export function HomeFaqHeadDecor() {
  return (
    <div className="homepage-faq__head-decor" aria-hidden="true">
      <NeoSpeechBubble className="homepage-faq__bubble" motion="float" delay={-2.4} />
      <DecorSparkle className="homepage-faq__sparkle" motion="twinkle" delay={-1.1} />
      <span className="homepage-faq__dots decor-dot-field" />
    </div>
  )
}

const questionStyle = { '--orn-depth': '0.7', '--orn-delay': '-1.8s', '--orn-duration': '5.6s' } as CSSProperties
const speechStyle = { '--orn-depth': '0.45', '--orn-delay': '-3.2s', '--orn-duration': '7s' } as CSSProperties

/** Section-wide layer: a 3D question mark peeking from behind the grid's right edge, a smaller speech icon in
 *  the heading row, a slow dashed orbit under the grid's bottom-right corner and a white cone peeking at the
 *  bottom-left corner. Pointer parallax on desktop only (ParallaxLayer). */
export function HomeFaqBackdrop() {
  return (
    <ParallaxLayer className="homepage-faq__backdrop">
      <span className="decor-shape homepage-faq__icon homepage-faq__icon--question" data-motion="bob" style={questionStyle}>
        <FluentIcon name="question" size={112} />
      </span>
      <span className="decor-shape homepage-faq__icon homepage-faq__icon--speech" data-motion="float" style={speechStyle}>
        <FluentIcon name="speech" size={56} />
      </span>
      <DecorRing className="homepage-faq__ring" motion="spin" depth={0.2} />
      <BrandOrnament name="cone-white" className="homepage-faq__cone" motion="drift" depth={0.3} delay={-4.5} duration={10} rotate={-14} />
    </ParallaxLayer>
  )
}
