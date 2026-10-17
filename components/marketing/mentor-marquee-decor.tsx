import { BrandOrnament } from './decor/brand-ornament'
import { DecorRing, DecorSparkle } from './decor/decor-shapes'
import { ParallaxLayer } from './decor/parallax-layer'

/**
 * Light decoration for the Meet Our Mentors heading row: a brand coil inside a slow dashed orbit, perched on
 * the "View all mentors" pill, plus two sparkles. Rendered inside the heading row so it stays anchored to the
 * pill; the portrait marquee below stays the focal point. Placement lives in app/home-mentors-decor.css.
 */
export function MentorSectionDecor() {
  return (
    <ParallaxLayer className="homepage-mentors__decor">
      <DecorRing className="homepage-mentors__orbit" motion="spin" depth={0.25} />
      <BrandOrnament name="coil-orange" className="homepage-mentors__coil" depth={0.9} delay={-1.6} duration={7} rotate={-16} />
      <DecorSparkle className="homepage-mentors__sparkle homepage-mentors__sparkle--a" motion="twinkle" depth={0.6} delay={-0.8} />
      <DecorSparkle className="homepage-mentors__sparkle homepage-mentors__sparkle--b" motion="twinkle" depth={0.45} delay={-2.1} />
    </ParallaxLayer>
  )
}
