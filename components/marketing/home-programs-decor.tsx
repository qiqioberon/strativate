import { BrandOrnament } from './decor/brand-ornament'
import { DecorDisc, DecorRing, DecorSparkle } from './decor/decor-shapes'
import { FluentIcon, type FluentIconName } from './decor/fluent-icon'
import { ParallaxLayer } from './decor/parallax-layer'

// Decoration for the homepage "Choose your path" block. Everything here is aria-hidden and placed by
// app/home-programs-decor.css; no copy, numbers or claims live in this file.

/** Inside the heading block: a sparkle sitting on the corner of the "100% impact" pill. */
export function HomeProgramsBackdrop() {
  return (
    <ParallaxLayer className="homepage-programs__decor">
      <DecorSparkle className="homepage-programs__sparkle is-impact" motion="twinkle" delay={-1.1} depth={0.5} />
    </ParallaxLayer>
  )
}

/**
 * Behind the two glass cards, as two mirrored corner groups: top-left of the first card (disc, dashed
 * orbit, pyramid, sparkle) and bottom-right of the second (disc, coil). The discs tuck under the card
 * corners and give the frosted glass colour to pick up; the two orange ornaments sit almost entirely
 * outside the cards, so each reads as a whole object resting on its disc rather than a cropped blob.
 */
export function HomeProgramsCardsBackdrop() {
  return (
    <ParallaxLayer className="homepage-programs__cards-decor">
      <span className="decor-dot-field homepage-programs__dots" />
      <DecorDisc className="homepage-programs__glow is-start" depth={0.2} />
      <DecorRing className="homepage-programs__orbit" depth={0.4} />
      <BrandOrnament name="pyramid-orange" className="homepage-programs__orn is-pyramid" depth={0.95} delay={-1.3} duration={7} rotate={-10} />
      <DecorSparkle className="homepage-programs__sparkle is-orbit" motion="twinkle" delay={-2.2} depth={0.6} />
      <DecorDisc className="homepage-programs__glow is-end" depth={0.2} />
      <BrandOrnament name="coil-orange" className="homepage-programs__orn is-coil" depth={0.6} delay={-3.6} duration={6.6} rotate={-8} />
    </ParallaxLayer>
  )
}

/** Small 3D icon in front of each share of the 40/60/100 bar (the bar itself carries the text). */
export function HomeProgramsMethodIcon({ name }: { name: FluentIconName }) {
  return <FluentIcon name={name} size={28} className="homepage-programs__method-icon" />
}
