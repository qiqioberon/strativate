import { BrandOrnament } from './decor/brand-ornament'
import { DecorRing, DecorSparkle } from './decor/decor-shapes'
import { ParallaxLayer } from './decor/parallax-layer'

/**
 * "Partnered with Leading Organizations" decoration: one section layer behind the logo wall, anchored to the
 * heading gutters and the wall's lower corners. aria-hidden and pointer-events none; placement lives in
 * app/home-partners-decor.css.
 */
export function HomePartnersBackdrop() {
  return (
    <ParallaxLayer className="homepage-partners__decor">
      <DecorRing className="homepage-partners__ring" motion="spin" depth={0.15} />
      <DecorSparkle className="homepage-partners__spark homepage-partners__spark--a" motion="twinkle" depth={0.5} delay={-1.1} />
      <DecorSparkle className="homepage-partners__spark homepage-partners__spark--b" motion="twinkle" depth={0.3} delay={-2.4} />
      <BrandOrnament name="pyramid-orange" className="homepage-partners__pyramid" depth={0.6} delay={-2.9} duration={7} rotate={-8} />
      <BrandOrnament name="torus-orange" className="homepage-partners__torus" motion="drift" depth={0.4} delay={-4.6} duration={11} rotate={-10} />
      <BrandOrnament name="coil-orange" className="homepage-partners__coil" depth={0.7} delay={-1.4} duration={6.5} rotate={16} />
    </ParallaxLayer>
  )
}
