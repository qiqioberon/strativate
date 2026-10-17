import { BrandOrnament } from './decor/brand-ornament'
import { DecorRing, DecorSparkle } from './decor/decor-shapes'
import { ParallaxLayer } from './decor/parallax-layer'

/**
 * "Why Choose Strativate?" decoration, in two layers so every piece stays anchored to the layout and clear of
 * the heading column. Both layers are aria-hidden and pointer-events none; placement lives in app/home-why-decor.css.
 */

/** Section layer (behind the container): a white dashed orbit in the right gutter beside the heading and a
 *  sparkle in the left gutter. Pointer parallax on desktop only (ParallaxLayer). */
export function HomeWhyBackdrop() {
  return (
    <ParallaxLayer className="homepage-why__decor">
      <DecorRing className="homepage-why__ring" motion="spin" depth={0.15} />
      <DecorSparkle className="homepage-why__spark homepage-why__spark--a" motion="twinkle" depth={0.5} delay={-0.9} />
      <DecorSparkle className="homepage-why__spark homepage-why__spark--b" motion="twinkle" depth={0.35} delay={-2.2} />
    </ParallaxLayer>
  )
}

/** Grid layer (inside the card grid, under the glass cards): an amber coil breaking the grid's right edge at
 *  mid height (its hidden half shows softly through the frosted cards) and a white cone tucked behind the
 *  bottom-left card's corner. */
export function HomeWhyCardsBackdrop() {
  return (
    <div className="decor-layer homepage-why__cards-decor" aria-hidden="true">
      <BrandOrnament name="coil-amber" className="homepage-why__coil" delay={-3.1} duration={7.5} rotate={14} />
      <BrandOrnament name="cone-white" className="homepage-why__cone" motion="drift" delay={-1.7} duration={10} rotate={-12} />
    </div>
  )
}
