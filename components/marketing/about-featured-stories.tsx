import { GraduationCap, Quote, Trophy } from 'lucide-react'

import type { AboutFeaturedStoryView } from '@/lib/marketing/about-featured-stories'

function StoryMedia({ story }: { story: AboutFeaturedStoryView }) {
  if (story.slot === 'story_one') {
    return (
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
    )
  }

  return (
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
  )
}

function QuoteCard({ story }: { story: AboutFeaturedStoryView }) {
  const AchievementIcon = story.slot === 'story_one' ? Trophy : GraduationCap

  return (
    <blockquote className="about-featured-story__quote">
      <span className="about-featured-story__quote-badge" aria-hidden="true"><Quote /></span>
      <p>{story.quote}</p>
      <footer>
        <div className="about-featured-story__person">
          <strong>{story.attribution_name}</strong>
          <span>{story.attribution_organization}</span>
          <span className="about-featured-story__achievement-text">{story.achievement_text}</span>
        </div>
        <span className="about-featured-story__achievement-icon" aria-hidden="true">
          <AchievementIcon />
        </span>
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
          <p>FEATURED STORY</p>
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
