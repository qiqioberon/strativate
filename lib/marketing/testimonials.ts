import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { TESTIMONIAL_IMAGE_BUCKET } from './testimonial-config'
import type { MarketingTestimonialView } from './testimonial-types'

export async function listPublishedTestimonials(): Promise<MarketingTestimonialView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('marketing_testimonials')
    .select('id,slug,competition_name,achievement,testimonial,participant_label,alt_text,image_path,sort_order')
    .eq('is_published', true)
    .not('image_path', 'is', null)
    .order('sort_order')
    .order('created_at')

  if (error) {
    console.warn('Marketing testimonials are unavailable.', { code: error.code })
    return []
  }

  return (data ?? [])
    .filter((item): item is typeof item & { image_path: string } => Boolean(item.image_path))
    .map(item => ({
      id: item.id,
      slug: item.slug,
      competition_name: item.competition_name,
      achievement: item.achievement,
      testimonial: item.testimonial,
      participant_label: item.participant_label,
      alt_text: item.alt_text,
      sort_order: item.sort_order,
      imageUrl: supabase.storage.from(TESTIMONIAL_IMAGE_BUCKET).getPublicUrl(item.image_path).data.publicUrl,
    }))
}
