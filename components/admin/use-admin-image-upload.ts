'use client'

import { useEffect, useRef, useState } from 'react'
import { adminFormError as formError } from '@/lib/auth/errors'
import type { SupabaseClient } from '@supabase/supabase-js'

import { PHOTO_SOURCE_BUCKET, sourceExtension, type CropOutput, type NormalizedCropRect } from '@/lib/media/image-crop'
import type { Database } from '@/lib/supabase/database.types'

export type AdminImageTarget = {
  width: number
  height: number
  maxBytes: number
  title: string
  description?: string
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

// Shared draft workflow. Persistence remains owned by each feature's form.
export function useAdminImageUpload({ supabase, target, onError }: {
  supabase: SupabaseClient<Database>
  target: AdminImageTarget
  onError: (message: string) => void
}) {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [processedFile, setProcessedFile] = useState<File | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [crop, setCrop] = useState<NormalizedCropRect | null>(null)
  const [initialCrop, setInitialCrop] = useState<NormalizedCropRect | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [loadingSource, setLoadingSource] = useState(false)
  const storedSourceRef = useRef(false)
  const generationRef = useRef(0)

  useEffect(() => {
    if (!processedFile) { setPreviewUrl(''); return }
    const url = URL.createObjectURL(processedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [processedFile])
  useEffect(() => () => { generationRef.current += 1 }, [])

  function cancelCrop() {
    setSourceFile(null)
    setInitialCrop(null)
    storedSourceRef.current = false
  }

  function reset(savedCrop: NormalizedCropRect | null = null) {
    generationRef.current += 1
    setLoadingSource(false)
    setOriginalFile(null)
    setProcessedFile(null)
    setCrop(savedCrop)
    setPreviewUrl('')
    cancelCrop()
  }

  function choose(file: File | null) {
    if (!file || loadingSource) return
    if (!allowedTypes.has(file.type)) { onError('Use a JPG, PNG, or WebP image.'); return }
    if (file.size > target.maxBytes) { onError(`Image must be ${target.maxBytes / 1024 / 1024} MB or smaller.`); return }
    onError('')
    setInitialCrop(null)
    storedSourceRef.current = false
    setSourceFile(file)
  }

  function apply(result: CropOutput) {
    if (!storedSourceRef.current) setOriginalFile(sourceFile)
    setProcessedFile(result.file)
    setCrop(result.crop)
    cancelCrop()
    onError('')
  }

  async function adjust(sourcePath: string | null | undefined) {
    if (loadingSource) return
    if (originalFile) {
      setInitialCrop(crop)
      storedSourceRef.current = false
      setSourceFile(originalFile)
      return
    }
    if (!sourcePath) return
    const generation = generationRef.current
    setLoadingSource(true)
    onError('')
    try {
      const { data, error } = await supabase.storage.from(PHOTO_SOURCE_BUCKET).download(sourcePath)
      if (generation !== generationRef.current) return
      if (error || !data) throw new Error(error?.message ?? 'Original source is unavailable.')
      storedSourceRef.current = true
      setInitialCrop(crop)
      setSourceFile(new File([data], `image-source.${sourceExtension(data)}`, { type: data.type || 'image/jpeg' }))
    } catch (caught) {
      if (generation === generationRef.current) onError(formError(caught, 'The original source could not be loaded. Check your connection or replace the image.'))
    } finally {
      if (generation === generationRef.current) setLoadingSource(false)
    }
  }

  return {
    originalFile, processedFile, crop, previewUrl, loadingSource, choose, adjust, reset,
    cropperProps: {
      sourceFile, initialCrop, aspectRatio: target.width / target.height,
      outputWidth: target.width, outputHeight: target.height,
      title: target.title, description: target.description, warnBelowOutput: true,
      onCancel: cancelCrop, onApply: apply,
    },
  }
}

export type AdminImageUpload = ReturnType<typeof useAdminImageUpload>
