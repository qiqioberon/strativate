const shapes = ['circle', 'square', 'diamond', 'triangle'] as const

export function HeroShapeGrid() {
  return (
    <div className="homepage-shape-grid" aria-hidden="true">
      {Array.from({ length: 35 }, (_, index) => (
        <span
          key={index}
          className={`homepage-shape-grid__shape is-${shapes[index % shapes.length]}`}
        />
      ))}
    </div>
  )
}
