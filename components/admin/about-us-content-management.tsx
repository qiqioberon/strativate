'use client'

import { Images, MessageSquareQuote } from 'lucide-react'
import { useState } from 'react'

import { AboutFeaturedStoryManagement } from '@/components/admin/about-featured-story-management'
import { WhoWeArePhotoManagement } from '@/components/admin/who-we-are-photo-management'

import dataStyles from './data-management.module.css'

type View = 'photos' | 'stories'

export function AboutUsContentManagement() {
  const [view, setView] = useState<View>('photos')

  return (
    <section className={dataStyles.page} data-testid="about-us-content-admin">
      <div className={dataStyles.viewSwitcher} role="tablist" aria-label="About Us content">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'photos'}
          className={dataStyles.viewTab + (view === 'photos' ? ' ' + dataStyles.viewTabActive : '')}
          onClick={() => setView('photos')}
        >
          <Images aria-hidden="true" size={15} /> Who We Are Photos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'stories'}
          className={dataStyles.viewTab + (view === 'stories' ? ' ' + dataStyles.viewTabActive : '')}
          onClick={() => setView('stories')}
        >
          <MessageSquareQuote aria-hidden="true" size={15} /> Featured Stories
        </button>
      </div>
      <div className={dataStyles.viewPanel}>
        {view === 'photos' ? <WhoWeArePhotoManagement /> : <AboutFeaturedStoryManagement />}
      </div>
    </section>
  )
}
