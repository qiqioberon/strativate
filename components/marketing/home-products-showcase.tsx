import type { ReactNode } from 'react'

import { BrandOrnament } from './decor/brand-ornament'
import { DecorDisc, DecorRing, NeoBurst, NeoSticker, NeoWindowCard } from './decor/decor-shapes'
import { FluentIcon, type FluentIconName } from './decor/fluent-icon'
import { ParallaxLayer } from './decor/parallax-layer'

// Homepage Digital Products block: format stickers for the copy column, the warm stage behind the Card Swap
// and the ornaments anchored to the card stack. Placement and sizing live in app/home-products-decor.css.

/** The three formats the section lede names ("guides, videos, and templates"), in the lede's own words. */
const productFormats: ReadonlyArray<{ label: string; icon: FluentIconName }> = [
  { label: 'Guides', icon: 'page' },
  { label: 'Videos', icon: 'clapper' },
  { label: 'Templates', icon: 'puzzle' },
]

export function HomeProductsFormats() {
  return (
    <ul className="home-products-formats">
      {productFormats.map((format) => (
        <li key={format.label}>
          <NeoSticker tone="white" icon={<FluentIcon name={format.icon} size={24} />}>{format.label}</NeoSticker>
        </li>
      ))}
    </ul>
  )
}

/**
 * Right-hand stage: a peach field that runs to the panel edges (the cream-to-peach tone step), with an orange
 * disc and a dashed ring bleeding off the panel edge behind the stack (two-column layout), and a torus breaking
 * out of the panel corner.
 */
export function HomeProductsStage({ children }: { children: ReactNode }) {
  return (
    <div className="home-products-stage">
      <div className="home-products-stage__field" aria-hidden="true">
        <DecorDisc className="home-products-stage__disc" />
        <DecorRing className="home-products-stage__ring" motion="spin" />
      </div>
      <ParallaxLayer className="home-products-stage__decor">
        <BrandOrnament name="torus-orange" className="home-products-stage__torus" motion="drift" depth={0.7} delay={-2.4} duration={9} rotate={-18} />
      </ParallaxLayer>
      <div className="home-products-stage__content">{children}</div>
    </div>
  )
}

/**
 * Ornaments anchored to the card stack. Rendered inside the Card Swap scene so they can follow the stack's own
 * scale and centre offset; the back layer sits behind the cards, the front layer above them.
 */
export function HomeProductsStackDecor() {
  return (
    <>
      <ParallaxLayer className="home-products-stack-decor home-products-stack-decor--back">
        {/* Single-column layouts: the disc sits right behind the stack instead of bleeding off the panel edge. */}
        <DecorDisc className="home-products-stack-decor__halo" depth={0.2} />
        <BrandOrnament name="coil-amber" className="home-products-stack-decor__coil" depth={1.1} delay={-1.3} duration={7} rotate={-10} />
        <NeoWindowCard className="home-products-stack-decor__window" variant="lines" depth={0.55} />
      </ParallaxLayer>
      <ParallaxLayer className="home-products-stack-decor home-products-stack-decor--front">
        <span className="home-products-stack-decor__badge">
          <FluentIcon name="rocket" size={26} />
          Ready-to-use
        </span>
        <NeoBurst className="home-products-stack-decor__burst" spin>
          <FluentIcon name="sparkles" size={34} />
        </NeoBurst>
      </ParallaxLayer>
    </>
  )
}
