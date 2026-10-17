import { cn } from '@/lib/utils'

import { BrandOrnament } from './decor/brand-ornament'
import { DecorSparkle } from './decor/decor-shapes'
import { ParallaxLayer } from './decor/parallax-layer'

/**
 * Homepage hero decoration: Strativate's own 3D ornaments (the strativate.id artwork) idling around the
 * headline, the call to action and the testimonial gallery, in three depth planes.
 * - far: a small softened coil tucked behind the coral coil;
 * - mid: the coils and the pyramid that frame the headline, lede and call to action;
 * - near: larger pieces that overlap the gallery edges and sink into the cloud band.
 * Decorative only: the layer is aria-hidden and ignores the pointer, so the WebGL gallery keeps every event.
 * Placement, per-breakpoint visibility and the entrance are in app/home-hero-decor.css.
 */
export function HomeHeroDecor({ gallery }: { gallery: boolean }) {
  return (
    <ParallaxLayer className={cn('home-hero-decor', !gallery && 'home-hero-decor--no-gallery')}>
      {/* Far plane */}
      <BrandOrnament name="coil-white" far eager motion="drift" depth={0.22} duration={7.9} delay={-2.4} rotate={14} className="home-hero-decor__orn home-hero-decor__orn--sky" />

      {/* Mid plane */}
      <BrandOrnament name="coil-amber" eager motion="float" depth={0.62} duration={6.4} delay={-1.3} rotate={-6} className="home-hero-decor__orn home-hero-decor__orn--amber" />
      <BrandOrnament name="coil-coral" eager motion="float" depth={0.58} duration={7.3} delay={-4.2} rotate={8} className="home-hero-decor__orn home-hero-decor__orn--coral" />
      <BrandOrnament name="coil-orange" eager motion="drift" depth={0.4} duration={5.8} delay={-3.3} rotate={-14} className="home-hero-decor__orn home-hero-decor__orn--spring" />
      <BrandOrnament name="pyramid-orange" eager motion="float" depth={0.54} duration={5.2} delay={-0.6} className="home-hero-decor__orn home-hero-decor__orn--pyramid" />

      {/* Near plane */}
      <BrandOrnament name="torus-orange" eager motion="float" depth={1.1} duration={6.9} delay={-2.9} rotate={-12} className="home-hero-decor__orn home-hero-decor__orn--near home-hero-decor__orn--torus" />
      <BrandOrnament name="cylinder-amber" eager motion="bob" depth={0.9} duration={7.6} delay={-6.2} rotate={10} className="home-hero-decor__orn home-hero-decor__orn--near home-hero-decor__orn--cylinder" />

      <DecorSparkle motion="twinkle" depth={0.25} delay={-0.8} className="home-hero-decor__spark home-hero-decor__spark--crown" />
      <DecorSparkle motion="twinkle" depth={0.25} delay={-2.3} className="home-hero-decor__spark home-hero-decor__spark--base" />
    </ParallaxLayer>
  )
}
