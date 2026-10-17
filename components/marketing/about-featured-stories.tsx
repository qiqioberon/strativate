import { BrandOrnament } from '@/components/marketing/decor/brand-ornament'
import { DecorRing, NeoSticker } from '@/components/marketing/decor/decor-shapes'
import { FluentIcon } from '@/components/marketing/decor/fluent-icon'
import { StoryAwardChip, StoryQuoteBadge } from '@/components/marketing/story-details'
import type { AboutFeaturedStoryView } from '@/lib/marketing/about-featured-stories'

function StoryMedia({ story }: { story: AboutFeaturedStoryView }) {
  if (story.slot === 'story_one') {
    return (
      <div className="about-featured-story__frame about-featured-story__frame--single">
        <div className="about-featured-story__decor" aria-hidden="true">
          <DecorRing className="about-featured-story__ring" motion="spin" />
          <BrandOrnament name="coil-amber" className="about-featured-story__ornament" delay={-1.4} duration={7} />
        </div>
        <div className="about-featured-story__media about-featured-story__media--single">
          {/* Supabase owns this processed public WebP derivative. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={story.primaryImageUrl}
            alt={story.primary_image_alt_text}
            width={1200}
            height={900}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="about-featured-story__frame about-featured-story__frame--pair">
      <div className="about-featured-story__decor" aria-hidden="true">
        <DecorRing className="about-featured-story__ring" motion="spin" />
        <BrandOrnament name="torus-orange" className="about-featured-story__ornament" delay={-2.6} duration={8} />
      </div>
      <div className="about-featured-story__media about-featured-story__media--pair">
        {/* Supabase owns these processed public WebP derivatives. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={story.primaryImageUrl}
          alt={story.primary_image_alt_text}
          width={900}
          height={1200}
          loading="lazy"
          decoding="async"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={story.secondaryImageUrl!}
          alt={story.secondary_image_alt_text ?? ''}
          width={900}
          height={1200}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  )
}

function QuoteCard({ story }: { story: AboutFeaturedStoryView }) {
  return (
    <blockquote className="about-featured-story__quote">
      <StoryQuoteBadge className="about-featured-story__quote-badge" />
      <p>{story.quote}</p>
      <footer>
        <div className="about-featured-story__person">
          <strong>{story.attribution_name}</strong>
          <span>{story.attribution_organization}</span>
        </div>
        <StoryAwardChip achievement={story.achievement_text} className="about-featured-story__award" />
      </footer>
    </blockquote>
  )
}

function FeaturedStoryBlock({ story }: { story: AboutFeaturedStoryView }) {
  const storyNumber = story.slot === 'story_one' ? 'one' : 'two'
  return (
    <article
      className={`about-featured-story about-featured-story--${storyNumber}`}
      data-testid={`about-featured-${story.slot}`}
    >
      <div className="marketing-container about-featured-story__inner">
        <header className="about-featured-story__heading">
          <NeoSticker as="p" tone="white" className="about-featured-story__label" icon={<FluentIcon name="sparkles" size={24} />}>
            Featured story
          </NeoSticker>
          <h2>{story.title}</h2>
        </header>
        <div className="about-featured-story__content">
          {story.slot === 'story_one' ? (
            <>
              <StoryMedia story={story} />
              <QuoteCard story={story} />
            </>
          ) : (
            <>
              <QuoteCard story={story} />
              <StoryMedia story={story} />
            </>
          )}
        </div>
      </div>
    </article>
  )
}

export function AboutFeaturedStories({ stories }: { stories: AboutFeaturedStoryView[] }) {
  const storyOne = stories.find(story => story.slot === 'story_one')
  const storyTwo = stories.find(story => story.slot === 'story_two')
  if (!storyOne && !storyTwo) return null

  return (
    <section className="about-featured-stories" data-testid="about-featured-stories-section">
      {storyOne ? <FeaturedStoryBlock story={storyOne} /> : null}
      {storyTwo ? <FeaturedStoryBlock story={storyTwo} /> : null}
    </section>
  )
}
