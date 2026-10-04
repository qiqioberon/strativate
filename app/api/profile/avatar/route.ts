import { NextResponse } from 'next/server'
import sharp from 'sharp'

import { getAccount } from '@/lib/auth/server'
import { cropRectFromJson, cropSourcePixels, sourceExtension } from '@/lib/media/image-crop'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'

export const runtime = 'nodejs'
const BUCKET = 'profile-avatars'
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function GET(request: Request) {
  const account = await getAccount()
  if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: profile, error } = await admin.from('profiles').select('avatar_path,avatar_source_path,avatar_crop').eq('id', account.user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
  const url = new URL(request.url)

  if (url.searchParams.has('meta')) {
    return NextResponse.json({
      hasAvatar: Boolean(profile?.avatar_path),
      hasSource: Boolean(profile?.avatar_source_path),
      crop: profile?.avatar_crop ?? null,
    })
  }

  const path = url.searchParams.has('source') ? profile?.avatar_source_path : profile?.avatar_path
  if (!path) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
  const { data, error: downloadError } = await admin.storage.from(BUCKET).download(path)
  if (downloadError || !data) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
  return new Response(await data.arrayBuffer(), {
    headers: {
      'content-type': url.searchParams.has('source') ? data.type || 'application/octet-stream' : 'image/webp',
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  })
}

export async function POST(request: Request) {
  const account = await getAccount()
  if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  let uploadedSourcePath: string | null = null
  let uploadedDerivativePath: string | null = null

  try {
    const form = await request.formData()
    const candidate = form.get('file')
    const file = candidate instanceof File ? candidate : null
    if (file && !ALLOWED.has(file.type)) return NextResponse.json({ error: 'Format foto harus JPG, PNG, atau WebP.' }, { status: 415 })
    if (file && (file.size <= 0 || file.size > MAX_BYTES)) return NextResponse.json({ error: 'Ukuran foto maksimal 8 MB.' }, { status: 413 })
    let rawCrop: unknown = null
    try { rawCrop = JSON.parse(String(form.get('crop') ?? 'null')) } catch { /* invalid input is handled below */ }
    const crop = cropRectFromJson(rawCrop)
    if (!crop) return NextResponse.json({ error: 'Area crop tidak valid.' }, { status: 400 })

    const { data: profile, error: profileError } = await admin.from('profiles').select('avatar_path,avatar_source_path').eq('id', account.user.id).single()
    if (profileError) throw profileError

    let source: Buffer
    let sourcePath = profile.avatar_source_path
    let sourceMime = file?.type ?? 'image/jpeg'
    if (file) {
      source = Buffer.from(await file.arrayBuffer())
    } else {
      if (!sourcePath) return NextResponse.json({ error: 'Sumber asli foto tidak tersedia. Unggah foto pengganti.' }, { status: 409 })
      const { data: storedSource, error: downloadError } = await admin.storage.from(BUCKET).download(sourcePath)
      if (downloadError || !storedSource) throw downloadError ?? new Error('Avatar source unavailable')
      source = Buffer.from(await storedSource.arrayBuffer())
      sourceMime = storedSource.type || sourceMime
    }

    const normalized = await sharp(source, { failOn: 'error' }).rotate().toBuffer({ resolveWithObject: true })
    const width = normalized.info.width
    const height = normalized.info.height
    if (!width || !height) return NextResponse.json({ error: 'Resolusi foto tidak valid.' }, { status: 400 })
    const selected = cropSourcePixels(crop, width, height)
    if (selected.width < 128 || selected.height < 128) return NextResponse.json({ error: 'Area crop minimal 128×128 px.' }, { status: 400 })
    if (Math.abs(selected.width / selected.height - 1) > .015) return NextResponse.json({ error: 'Area crop harus berbentuk persegi.' }, { status: 400 })

    const left = Math.max(0, Math.min(width - 1, Math.round(selected.x)))
    const top = Math.max(0, Math.min(height - 1, Math.round(selected.y)))
    const extractWidth = Math.max(1, Math.min(width - left, Math.round(selected.width)))
    const extractHeight = Math.max(1, Math.min(height - top, Math.round(selected.height)))
    const output = await sharp(normalized.data)
      .extract({ left, top, width: extractWidth, height: extractHeight })
      .resize(512, 512, { fit: 'fill' })
      .webp({ lossless: true })
      .toBuffer()

    if (file) {
      uploadedSourcePath = `${account.user.id}/sources/${crypto.randomUUID()}.${sourceExtension(file)}`
      const sourceUpload = await admin.storage.from(BUCKET).upload(uploadedSourcePath, source, { contentType: file.type, upsert: false, cacheControl: '3600' })
      if (sourceUpload.error) throw sourceUpload.error
      sourcePath = uploadedSourcePath
    }
    uploadedDerivativePath = `${account.user.id}/derivatives/${crypto.randomUUID()}.webp`
    const upload = await admin.storage.from(BUCKET).upload(uploadedDerivativePath, output, { contentType: 'image/webp', upsert: false, cacheControl: '3600' })
    if (upload.error) throw upload.error
    const update = await admin.from('profiles').update({ avatar_path: uploadedDerivativePath, avatar_source_path: sourcePath, avatar_crop: crop as unknown as Json }).eq('id', account.user.id)
    if (update.error) throw update.error

    const cleanupPaths = [profile.avatar_path, file ? profile.avatar_source_path : null].filter((path): path is string => Boolean(path && path !== uploadedDerivativePath && path !== sourcePath))
    const cleanup = cleanupPaths.length ? await admin.storage.from(BUCKET).remove(cleanupPaths) : { error: null }
    return NextResponse.json({
      path: uploadedDerivativePath,
      avatarUrl: `/api/profile/avatar?rev=${Date.now()}`,
      cleanupWarning: cleanup.error ? 'Foto tersimpan, tetapi file lama masih perlu dibersihkan.' : null,
      sourceMime,
    })
  } catch (error) {
    if (uploadedDerivativePath || uploadedSourcePath) {
      const { data: persisted, error: reconciliationError } = await admin.from('profiles').select('avatar_path,avatar_source_path').eq('id', account.user.id).maybeSingle()
      const savedDespiteResponse = Boolean(persisted)
        && (!uploadedDerivativePath || persisted?.avatar_path === uploadedDerivativePath)
        && (!uploadedSourcePath || persisted?.avatar_source_path === uploadedSourcePath)
      if (savedDespiteResponse) {
        return NextResponse.json({ path: uploadedDerivativePath, avatarUrl: `/api/profile/avatar?rev=${Date.now()}`, cleanupWarning: 'Foto tersimpan; respons penyimpanan awal tidak dapat dikonfirmasi.' })
      }
      if (!reconciliationError) {
        if (uploadedDerivativePath) await admin.storage.from(BUCKET).remove([uploadedDerivativePath])
        if (uploadedSourcePath) await admin.storage.from(BUCKET).remove([uploadedSourcePath])
      }
    }
    console.error('Profile avatar upload failed', error)
    return NextResponse.json({ error: 'Foto profil belum dapat diproses. Coba file lain atau ulangi beberapa saat lagi.' }, { status: 400 })
  }
}

export async function DELETE() {
  const account = await getAccount()
  if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: profile, error: lookupError } = await admin.from('profiles').select('avatar_path,avatar_source_path').eq('id', account.user.id).maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'Foto profil belum dapat dihapus karena file tersimpan belum dapat diperiksa.' }, { status: 400 })
  const { error } = await admin.from('profiles').update({ avatar_path: null, avatar_source_path: null, avatar_crop: null }).eq('id', account.user.id)
  if (error) return NextResponse.json({ error: 'Foto profil belum dapat dihapus.' }, { status: 400 })
  const paths = [profile?.avatar_path, profile?.avatar_source_path].filter((path): path is string => Boolean(path))
  const cleanup = paths.length ? await admin.storage.from(BUCKET).remove(paths) : { error: null }
  return NextResponse.json({ ok: true, cleanupWarning: cleanup.error ? 'Foto dihapus, tetapi file lama masih perlu dibersihkan.' : null })
}
