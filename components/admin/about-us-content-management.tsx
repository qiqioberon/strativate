'use client'

import { ImageIcon, Images, MessageSquareQuote } from 'lucide-react'
import { useState } from 'react'

import { AboutFeaturedStoryManagement } from '@/components/admin/about-featured-story-management'
import { AboutStoryImageManagement } from '@/components/admin/about-story-image-management'
import { WhoWeArePhotoManagement } from '@/components/admin/who-we-are-photo-management'

import dataStyles from './data-management.module.css'

type View = 'photos' | 'story-image' | 'stories'

export function AboutUsContentManagement() {
  const [view, setView] = useState<View>('photos')
  return (
    <section className={dataStyles.page} data-testid="about-us-content-admin">
      <div className={dataStyles.viewSwitcher} role="tablist" aria-label="About Us content">
        <button type="button" role="tab" aria-selected={view === 'photos'} className={dataStyles.viewTab + (view === 'photos' ? ' ' + dataStyles.viewTabActive : '')} onClick={() => setView('photos')}>
          <Images aria-hidden="true" size={15} /> Who We Are Photos
        </button>
        <button type="button" role="tab" aria-selected={view === 'story-image'} className={dataStyles.viewTab + (view === 'story-image' ? ' ' + dataStyles.viewTabActive : '')} onClick={() => setView('story-image')}>
          <ImageIcon aria-hidden="true" size={15} /> Story Image
        </button>
        <button type="button" role="tab" aria-selected={view === 'stories'} className={dataStyles.viewTab + (view === 'stories' ? ' ' + dataStyles.viewTabActive : '')} onClick={() => setView('stories')}>
          <MessageSquareQuote aria-hidden="true" size={15} /> Featured Stories
        </button>
      </div>
      <div className={dataStyles.viewPanel}>
        {view === 'photos' ? <WhoWeArePhotoManagement /> : null}
        {view === 'story-image' ? <AboutStoryImageManagement /> : null}
        {view === 'stories' ? <AboutFeaturedStoryManagement /> : null}
      </div>
    </section>
  )
}
