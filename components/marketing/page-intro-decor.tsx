import { BrandOrnament } from './decor/brand-ornament'
import { DecorSparkle } from './decor/decor-shapes'
import { ParallaxLayer } from './decor/parallax-layer'

/**
 * Page intro decoration: the homepage hero's brand 3D ornaments (the strativate.id artwork) idling around
 * every other page hero (/program, /mentor, /digital-products, /publications, /competitions, /about-us, /faq).
 * Three depth planes, as in the hero:
 * - far: a small softened white coil tucked behind the base of the coral coil;
 * - mid: the amber and coral coils in the upper corners and the pyramid at mid height;
 * - near: the torus and the cylinder breaking the lower corners of the section.
 * The intro is short and its titles range from "FAQ" to a two-line "Discover Top Competitions", so the pieces
 * are anchored to the section edges and outer thirds (outside the centred copy column), never to the text.
 * Decorative only: the layer is aria-hidden and ignores the pointer. Placement, per-breakpoint visibility and
 * the entrance are in app/page-intro-decor.css.
 */
export function PageIntroDecor() {
  return (
    <ParallaxLayer className="page-intro-decor">
      {/* Far plane */}
      <BrandOrnament name="coil-white" far eager motion="drift" depth={0.3} duration={8.2} delay={-3.1} rotate={-16} className="page-intro-decor__orn page-intro-decor__orn--spring" />

      {/* Mid plane */}
      <BrandOrnament name="coil-amber" eager motion="float" depth={0.62} duration={6.4} delay={-1.3} rotate={-6} className="page-intro-decor__orn page-intro-decor__orn--amber" />
      <BrandOrnament name="coil-coral" eager motion="float" depth={0.58} duration={7.3} delay={-4.2} rotate={8} className="page-intro-decor__orn page-intro-decor__orn--coral" />
      <BrandOrnament name="pyramid-orange" eager motion="float" depth={0.54} duration={5.2} delay={-0.6} className="page-intro-decor__orn page-intro-decor__orn--pyramid" />

      {/* Near plane */}
      <BrandOrnament name="torus-orange" eager motion="float" depth={1.1} duration={6.9} delay={-2.9} rotate={-12} className="page-intro-decor__orn page-intro-decor__orn--near page-intro-decor__orn--torus" />
      <BrandOrnament name="cylinder-amber" eager motion="bob" depth={0.9} duration={7.6} delay={-6.2} rotate={10} className="page-intro-decor__orn page-intro-decor__orn--near page-intro-decor__orn--cylinder" />

      <DecorSparkle motion="twinkle" depth={0.25} delay={-0.8} className="page-intro-decor__spark page-intro-decor__spark--crown" />
      <DecorSparkle motion="twinkle" depth={0.25} delay={-2.3} className="page-intro-decor__spark page-intro-decor__spark--base" />
    </ParallaxLayer>
  )
}
