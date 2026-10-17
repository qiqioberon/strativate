import { BrandOrnament } from './decor/brand-ornament'
import { CircularTextBadge, DecorRing, DecorSparkle, NeoIdCard, NeoScoreCard, NeoWindowCard } from './decor/decor-shapes'
import { FluentIcon } from './decor/fluent-icon'
import { ParallaxLayer } from './decor/parallax-layer'

// The seal repeats two phrases from the section lede ("future-ready skills", "top honors"); it adds no claim of its own.
const SEAL_TEXT = 'Future-ready skills • Top honors • '

/**
 * Who We Are "competition kit": neobrutalist framing vectors arranged around the photo collage.
 * Two pointer-parallax planes share the collage's grid cell, one behind the frames and one in front of them, and each holds
 * a square stage that mirrors the collage so every piece can be anchored to a frame corner or edge. When there are no photos
 * the same pieces regroup into a small still life (desktop only). Purely decorative: both planes are aria-hidden and the
 * section stylesheet (app/home-who-we-are-decor.css) owns all placement.
 */
export function WhoWeAreBackdrop() {
  return (
    <>
      <ParallaxLayer className="homepage-who__decor homepage-who__decor--back">
        <div className="homepage-who__stage">
          <span className="decor-dot-field homepage-who__dots" />
          <DecorRing className="homepage-who__ring" motion="spin" depth={0.12} />
          <NeoIdCard className="homepage-who__piece homepage-who__piece--id" motion="float" depth={0.7} delay={-2.2} />
          <NeoWindowCard className="homepage-who__piece homepage-who__piece--window" variant="checks" motion="bob" depth={0.5} delay={-3.6} />
          <NeoScoreCard className="homepage-who__piece homepage-who__piece--score" motion="bob" depth={0.42} delay={-1.1} />
        </div>
      </ParallaxLayer>
      <ParallaxLayer className="homepage-who__decor homepage-who__decor--front">
        <div className="homepage-who__stage">
          <CircularTextBadge id="who-we-are-seal" text={SEAL_TEXT} className="homepage-who__seal">
            <FluentIcon name="trophy" size={48} />
          </CircularTextBadge>
          <BrandOrnament name="coil-amber" className="homepage-who__coil" depth={1.15} delay={-2.8} duration={7} rotate={-14} />
          <DecorSparkle className="homepage-who__spark homepage-who__spark--top" motion="twinkle" depth={0.9} delay={-0.8} />
          <DecorSparkle className="homepage-who__spark homepage-who__spark--low" motion="twinkle" depth={0.6} delay={-2.1} />
        </div>
      </ParallaxLayer>
    </>
  )
}
