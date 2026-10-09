'use client'

import { ImageIcon, Images, MessageSquareQuote } from 'lucide-react'
import { useRef, useState } from 'react'

import { AboutFeaturedStoryManagement } from '@/components/admin/about-featured-story-management'
import { AboutStoryImageManagement } from '@/components/admin/about-story-image-management'
import { WhoWeArePhotoManagement } from '@/components/admin/who-we-are-photo-management'

import dataStyles from './data-management.module.css'

type View = 'photos' | 'story-image' | 'stories'

export function AboutUsContentManagement() {
  const [view, setView] = useState<View>('photos')
  const panelRef = useRef<HTMLDivElement>(null)
  function changeView(next: View) {
    if (next === view || panelRef.current?.querySelector('[data-pending-save="true"]')) return
    if (panelRef.current?.querySelector('[data-unsaved-changes="true"]') && !window.confirm('Discard unsaved content changes?')) return
    setView(next)
  }
  return (
    <section className={dataStyles.page} data-testid="about-us-content-admin">
      <header className={dataStyles.pageHeader}><div className={dataStyles.pageHeaderCopy}><h2>About Us Content</h2></div></header>
      <div className={dataStyles.viewSwitcher} role="tablist" aria-label="About Us content">
        <button type="button" role="tab" aria-selected={view === 'photos'} className={dataStyles.viewTab + (view === 'photos' ? ' ' + dataStyles.viewTabActive : '')} onClick={() => changeView('photos')}>
          <Images aria-hidden="true" size={15} /> Who We Are Photos
        </button>
        <button type="button" role="tab" aria-selected={view === 'story-image'} className={dataStyles.viewTab + (view === 'story-image' ? ' ' + dataStyles.viewTabActive : '')} onClick={() => changeView('story-image')}>
          <ImageIcon aria-hidden="true" size={15} /> Story Image
        </button>
        <button type="button" role="tab" aria-selected={view === 'stories'} className={dataStyles.viewTab + (view === 'stories' ? ' ' + dataStyles.viewTabActive : '')} onClick={() => changeView('stories')}>
          <MessageSquareQuote aria-hidden="true" size={15} /> Featured Stories
        </button>
      </div>
      <div ref={panelRef} className={dataStyles.viewPanel}>
        {view === 'photos' ? <WhoWeArePhotoManagement /> : null}
        {view === 'story-image' ? <AboutStoryImageManagement /> : null}
        {view === 'stories' ? <AboutFeaturedStoryManagement /> : null}
      </div>
    </section>
  )
}
