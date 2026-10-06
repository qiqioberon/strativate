import { PHOTO_SOURCE_BUCKET, sourceExtension } from './image-crop'

export type ImageReferences = { path: string | null; sourcePath: string | null }

type Options = {
  original: File | null
  derivative: File | null
  sourcePrefix: string
  derivativePrefix: string
  previous: ImageReferences
  upload: (bucket: string, path: string, file: File) => Promise<void>
  remove: (bucket: string, path: string) => Promise<void>
  persist: (refs: ImageReferences) => Promise<void>
  reconcile: () => Promise<ImageReferences[]>
}

// Never remove an old object until persistence succeeds (or reconciliation confirms it).
export async function persistAdminImage(options: Options): Promise<ImageReferences & { warning: string }> {
  const { previous, sourcePrefix, derivativePrefix, upload, remove, persist, reconcile } = options
  const next = { ...previous }
  let uploadedPath: string | null = null
  let uploadedSourcePath: string | null = null
  let warning = ''
  async function cleanup(bucket: string, path: string) {
    try { await remove(bucket, path) }
    catch { warning += ' A stored image needs manual Storage cleanup.' }
  }
  try {
    if (options.original) {
      uploadedSourcePath = `${sourcePrefix}${crypto.randomUUID()}.${sourceExtension(options.original)}`
      await upload(PHOTO_SOURCE_BUCKET, uploadedSourcePath, options.original)
      next.sourcePath = uploadedSourcePath
    }
    if (options.derivative) {
      uploadedPath = `${derivativePrefix}${crypto.randomUUID()}.webp`
      await upload('marketing-editorial', uploadedPath, options.derivative)
      next.path = uploadedPath
    }
    await persist(next)
  } catch (caught) {
    // A lost response is not proof that the write failed. Preserve files if we cannot check.
    let rows: ImageReferences[]
    try { rows = await reconcile() }
    catch {
      throw new Error(`${caught instanceof Error ? caught.message : 'Image could not be saved.'} New files were preserved because database status could not be confirmed. Review Storage before retrying.`)
    }
    const confirmed = Boolean(uploadedPath || uploadedSourcePath) && rows.some(row => (
      (!uploadedPath || row.path === uploadedPath) && (!uploadedSourcePath || row.sourcePath === uploadedSourcePath)
    ))
    if (!confirmed) {
      if (uploadedPath && !rows.some(row => row.path === uploadedPath)) await cleanup('marketing-editorial', uploadedPath)
      if (uploadedSourcePath && !rows.some(row => row.sourcePath === uploadedSourcePath)) await cleanup(PHOTO_SOURCE_BUCKET, uploadedSourcePath)
      throw new Error(`${caught instanceof Error ? caught.message : 'Image could not be saved.'}${warning}`)
    }
  }
  if (previous.path && previous.path !== next.path && previous.path.startsWith(derivativePrefix)) {
    await cleanup('marketing-editorial', previous.path)
  }
  if (previous.sourcePath && previous.sourcePath !== next.sourcePath && previous.sourcePath.startsWith(sourcePrefix)) {
    await cleanup(PHOTO_SOURCE_BUCKET, previous.sourcePath)
  }
  return { ...next, warning }
}
