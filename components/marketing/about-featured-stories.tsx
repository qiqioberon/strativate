import { ArrowRight, Quote, Trophy } from 'lucide-react'
import Link from 'next/link'

import type { AboutFeaturedStoryView } from '@/lib/marketing/about-featured-stories'

function StoryMedia({ story }: { story: AboutFeaturedStoryView }) {
  const pair = story.media_layout === 'pair' && story.secondaryImageUrl
  return (
    <div className={`about-featured-story__media ${pair ? 'about-featured-story__media--pair' : 'about-featured-story__media--single'}`}>
      {/* Supabase owns these processed public WebP derivatives. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={story.primaryImageUrl}
        alt={story.primary_image_alt_text}
        width={pair ? 1000 : 1200}
        height={pair ? 1250 : 900}
        loading="lazy"
        decoding="async"
      />
      {pair ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={story.secondaryImageUrl!}
            alt={story.secondary_image_alt_text ?? ''}
            width={1000}
            height={1250}
            loading="lazy"
            decoding="async"
          />
        </>
      ) : null}
    </div>
  )
}

function QuoteCard({ story }: { story: AboutFeaturedStoryView }) {
  return (
    <blockquote className="about-featured-story__quote">
      <span className="about-featured-story__quote-badge" aria-hidden="true"><Quote /></span>
      <p>{story.quote}</p>
      <footer>
        <div className="about-featured-story__person">
          <strong>{story.attribution_name}</strong>
          <span>{story.attribution_organization}</span>
        </div>
        <div className="about-featured-story__achievement">
          <span className="about-featured-story__achievement-icon" aria-hidden="true"><Trophy /></span>
          <span>{story.achievement_text}</span>
        </div>
      </footer>
    </blockquote>
  )
}

export function AboutFeaturedStories({ stories }: { stories: AboutFeaturedStoryView[] }) {
  if (!stories.length) return null

  return (
    <section className="marketing-section about-featured-stories" data-testid="about-featured-stories-section">
      <div className="marketing-container about-featured-stories__inner">
        <div className="about-featured-stories__list">
          {stories.map((story, index) => (
            <article
              className={`about-featured-story ${index % 2 ? 'about-featured-story--reverse' : ''}`}
              key={story.id}
            >
              <header className="about-featured-story__heading">
                <p className="marketing-kicker">FEATURED STORY</p>
                <h2>{story.title}</h2>
              </header>
              <StoryMedia story={story} />
              <QuoteCard story={story} />
            </article>
          ))}
        </div>
        <div className="about-featured-stories__cta">
          <Link className="button button-primary" href="/publications">
            More Success Stories <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </div>
    </section>
  )
}
