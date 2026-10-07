'use client'

import { CircleAlert, ImageIcon, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { AdminImageUploadField } from '@/components/admin/admin-image-upload-field'
import { useAdminImageUpload } from '@/components/admin/use-admin-image-upload'
import { formError } from '@/lib/auth/errors'
import {
  ABOUT_US_STORY_IMAGE_BUCKET,
  ABOUT_US_STORY_IMAGE_PREFIX,
  ABOUT_US_STORY_IMAGE_TARGET,
  ABOUT_US_STORY_MEDIA_ID,
  ABOUT_US_STORY_SOURCE_PREFIX,
} from '@/lib/marketing/about-us-story-config'
import { persistAdminImage } from '@/lib/media/admin-image-storage'
import { cropRectFromJson } from '@/lib/media/image-crop'
import { createClient } from '@/lib/supabase/client'
import type { AboutUsStoryMedia, Json } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import styles from './who-we-are-photo-management.module.css'

const migrationName = '202610080001_about_us_story_media.sql'

function isSetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST202'
    || code === 'PGRST205'
    || code === '42P01'
    || (message.includes('about_us_story_media') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ))
}

export function AboutUsContentManagement() {
  const supabase = useMemo(() => createClient(), [])
  const [media, setMedia] = useState<AboutUsStoryMedia | null>(null)
  const [altText, setAltText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const hydratedVersion = useRef<string | null>(null)
  const image = useAdminImageUpload({ supabase, target: ABOUT_US_STORY_IMAGE_TARGET, onError: setError })
  const busy = saving || image.loadingSource

  const publicUrl = useCallback((path: string) => (
    supabase.storage.from(ABOUT_US_STORY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  ), [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)

    const { data, error: loadError } = await supabase.rpc('admin_list_about_us_story_media')
    if (loadError) {
      setMedia(null)
      setAltText('')
      if (isSetupRequired(loadError)) setSetupRequired(true)
      else {
        setLoadFailed(true)
        setError(formError(loadError, 'About Us content could not be loaded. Check the connection and try again.'))
      }
    } else {
      const next = data?.[0] ?? null
      setMedia(next)
      setAltText(next?.alt_text ?? '')
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const version = media ? `${media.updated_at}:${media.image_path ?? ''}` : 'empty'
    if (hydratedVersion.current === version) return
    hydratedVersion.current = version
    image.reset(cropRectFromJson(media?.image_crop))
  }, [image, media])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const trimmedAlt = altText.trim()
    const storedPath = media?.image_path ?? null
    if (!image.processedFile && !storedPath) {
      setError('Choose an image and apply the crop before saving.')
      return
    }
    if (!trimmedAlt) {
      setError('Alt text is required when an image exists.')
      return
    }
    if (trimmedAlt.length > 300) {
      setError('Alt text must be 300 characters or fewer.')
      return
    }
    if (image.processedFile && !image.crop) {
      setError('Apply the crop before saving.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await persistAdminImage({
        original: image.originalFile,
        derivative: image.processedFile,
        sourcePrefix: ABOUT_US_STORY_SOURCE_PREFIX,
        derivativePrefix: ABOUT_US_STORY_IMAGE_PREFIX,
        previous: {
          path: storedPath,
          sourcePath: media?.source_image_path ?? null,
        },
        upload: async (bucket, path, file) => {
          const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
            cacheControl: '3600',
            contentType: file.type,
            upsert: false,
          })
          if (uploadError) throw uploadError
        },
        remove: async (bucket, path) => {
          const { error: removeError } = await supabase.storage.from(bucket).remove([path])
          if (removeError) throw removeError
        },
        persist: async refs => {
          const { error: persistError } = await supabase
            .from('about_us_story_media')
            .upsert({
              id: ABOUT_US_STORY_MEDIA_ID,
              image_path: refs.path,
              source_image_path: refs.sourcePath,
              image_crop: (image.crop ?? media?.image_crop ?? null) as Json | null,
              alt_text: trimmedAlt,
            }, { onConflict: 'id' })
          if (persistError) throw persistError
        },
        reconcile: async () => {
          const { data, error: reconcileError } = await supabase.rpc('admin_list_about_us_story_media')
          if (reconcileError) throw reconcileError
          return (data ?? []).map(row => ({
            path: row.image_path,
            sourcePath: row.source_image_path,
          }))
        },
      })

      setNotice('About Us editorial image saved.' + result.warning)
      await load()
    } catch (caught) {
      setError(formError(caught, 'About Us editorial image could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Content · About Us</p>
        <h2>About Us Content</h2>
        <p>Manage the single editorial image used beside the About Us story. Page copy remains source-controlled.</p>
      </div>
      <span className={dataStyles.countPill}><ImageIcon aria-hidden="true" />1 fixed slot</span>
    </header>
  )

  if (loading) return <section className={dataStyles.page} aria-busy="true">{pageHeader}<div className={styles.stateCard} role="status"><RefreshCw aria-hidden="true" /> Loading About Us content…</div></section>
  if (setupRequired) return <section className={dataStyles.page}>{pageHeader}<div className={styles.stateCard} role="alert"><CircleAlert aria-hidden="true" /><strong>Database setup required.</strong><p>Apply migration <code>{migrationName}</code> before managing this image.</p><button type="button" className="button button-outline" onClick={() => void load()}>Try again</button></div></section>
  if (loadFailed) return <section className={dataStyles.page}>{pageHeader}<div className={styles.stateCard} role="alert"><CircleAlert aria-hidden="true" /><strong>About Us content could not be loaded.</strong><p>{error}</p><button type="button" className="button button-outline" onClick={() => void load()}>Try again</button></div></section>

  return (
    <section className={dataStyles.page} data-testid="about-us-content-admin-section" aria-busy={busy}>
      {pageHeader}
      {error ? <p className={dataStyles.feedback + ' ' + dataStyles.errorFeedback} role="alert">{error}</p> : null}
      {notice ? <p className={dataStyles.feedback + ' ' + dataStyles.successFeedback} role="status">{notice}</p> : null}

      <div className={dataStyles.surface}>
        <div className={dataStyles.surfaceHeader}>
          <div className={dataStyles.surfaceHeaderCopy}>
            <p className="kicker">Story image</p>
            <h3>Editorial media</h3>
            <p>Uploads are cropped to a locked 4:3 frame. The public page omits this media column when no image has been configured.</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={save} noValidate>
          <div className={styles.fields}>
            <label>
              Alt text
              <input
                type="text"
                value={altText}
                maxLength={300}
                disabled={busy}
                onChange={event => setAltText(event.target.value)}
              />
            </label>
            <small className={styles.help}>Describe the approved editorial image for screen-reader users. The image itself is the only About Us content managed here.</small>
          </div>

          <div className={styles.previewColumn}>
            <AdminImageUploadField
              image={image}
              target={ABOUT_US_STORY_IMAGE_TARGET}
              storedUrl={media?.image_path ? publicUrl(media.image_path) : null}
              sourcePath={media?.source_image_path}
              alt={altText || 'About Us editorial image preview'}
              disabled={busy}
              onApplied={() => setError('')}
            />
          </div>

          <div className={styles.formActions}>
            <button className="button button-primary" type="submit" disabled={busy}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
