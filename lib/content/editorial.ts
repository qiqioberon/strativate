import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Competition, Publication } from '@/lib/supabase/database.types'
import { parseRichTextDocument, type RichTextDocument } from '@/lib/content/rich-text'

export type PublicPublication = Omit<Publication, 'cover_source_path' | 'cover_crop'> & {
  coverUrl: string | null
  categoryName: string | null
  bodyDocument: RichTextDocument
}

export type PublicCompetition = Omit<Competition, 'cover_source_path' | 'cover_crop'> & {
  coverUrl: string | null
  categoryName: string | null
}

function coverUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  return path ? supabase.storage.from('marketing-editorial').getPublicUrl(path).data.publicUrl : null
}

export async function listPublishedPublications(): Promise<PublicPublication[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('publications')
    .select('id,slug,title,excerpt,body,body_json,category,category_id,cover_path,cover_alt_text,published_at,is_published,is_featured,sort_order,created_at,updated_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Publications are unavailable.', { code: error.code })
    return []
  }

  const categoryIds = Array.from(new Set((data ?? []).map(item => item.category_id).filter((id): id is string => Boolean(id))))
  const { data: categoryRows } = categoryIds.length
    ? await supabase.from('publication_categories').select('id,name').in('id', categoryIds)
    : { data: [] as { id: string; name: string }[] }
  const categoryNames = new Map((categoryRows ?? []).map(item => [item.id, item.name]))

  return (data ?? []).map(item => {
    const categoryName = item.category_id ? categoryNames.get(item.category_id) ?? item.category ?? null : item.category ?? null
    return {
      ...item,
      category: categoryName,
      categoryName,
      bodyDocument: parseRichTextDocument(item.body_json, item.body),
      coverUrl: coverUrl(supabase, item.cover_path),
    }
  })
}

export async function listPublishedCompetitions(): Promise<PublicCompetition[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('competitions')
    .select('id,slug,name,category_id,description,rules_url,registration_url,registration_deadline,cover_path,cover_alt_text,status,is_published,is_featured,sort_order,created_at,updated_at')
    .eq('is_published', true)
    .order('registration_deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Competitions are unavailable.', { code: error.code })
    return []
  }

  const categoryIds = Array.from(new Set((data ?? []).map(item => item.category_id).filter((id): id is string => Boolean(id))))
  const { data: categoryRows } = categoryIds.length
    ? await supabase.from('competition_categories').select('id,name').in('id', categoryIds)
    : { data: [] as { id: string; name: string }[] }
  const categoryNames = new Map((categoryRows ?? []).map(item => [item.id, item.name]))

  return (data ?? []).map(item => ({
    ...item,
    coverUrl: coverUrl(supabase, item.cover_path),
    categoryName: item.category_id ? categoryNames.get(item.category_id) ?? null : null,
  }))
}

export async function getPublishedPublicationBySlug(slug: string) {
  return (await listPublishedPublications()).find(publication => publication.slug === slug) ?? null
}

export async function getPublishedCompetitionBySlug(slug: string) {
  return (await listPublishedCompetitions()).find(competition => competition.slug === slug) ?? null
}
