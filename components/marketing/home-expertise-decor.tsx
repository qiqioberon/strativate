import { BrandOrnament } from './decor/brand-ornament'
import { DecorRing, DecorSparkle } from './decor/decor-shapes'
import { ParallaxLayer } from './decor/parallax-layer'

/**
 * "What We Specialize In" decoration, split in two layers so every piece stays anchored to the layout and
 * never crosses the heading column or a card gutter. Both layers are aria-hidden and pointer-events none;
 * placement lives in app/home-expertise-decor.css.
 */

/** Section layer (behind the container): a white dashed orbit in the left gutter beside the heading and two
 *  sparkles in the right gutter. Pointer parallax on desktop only (ParallaxLayer). */
export function HomeExpertiseBackdrop() {
  return (
    <ParallaxLayer className="homepage-expertise__decor">
      <DecorRing className="homepage-expertise__ring" motion="spin" depth={0.15} />
      <DecorSparkle className="homepage-expertise__spark homepage-expertise__spark--a" motion="twinkle" depth={0.5} delay={-1.3} />
      <DecorSparkle className="homepage-expertise__spark homepage-expertise__spark--b" motion="twinkle" depth={0.35} delay={-2.6} />
    </ParallaxLayer>
  )
}

/** Grid layer (inside the card grid, under the cards): an amber coil peeking from behind the top-right card's
 *  corner and a white cone resting behind the bottom-left card's corner. Each piece only overlaps the corner
 *  card itself, so nothing shows through the gutters between cards. */
export function HomeExpertiseCardsBackdrop() {
  return (
    <div className="decor-layer homepage-expertise__cards-decor" aria-hidden="true">
      <BrandOrnament name="coil-amber" className="homepage-expertise__coil" delay={-2.2} duration={7} rotate={-12} />
      <BrandOrnament name="cone-white" className="homepage-expertise__cone" motion="drift" delay={-4.1} duration={10} rotate={10} />
    </div>
  )
}
