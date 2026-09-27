import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { CompetitionRecognition } from '@/lib/supabase/database.types'

export type CompetitionRecognitionView = Pick<
  CompetitionRecognition,
  'id' | 'competition_name' | 'display_order'
> & {
  logoUrl: string
}

export async function listActiveCompetitionRecognitions(): Promise<CompetitionRecognitionView[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('competition_recognitions')
    .select('id,competition_name,logo_path,display_order')
    .eq('is_active', true)
    .order('display_order')
    .order('created_at')
    .order('id')

  if (error) {
    console.warn('Competition recognitions are unavailable.', { code: error.code })
    return []
  }

  return (data ?? []).map((recognition) => ({
    id: recognition.id,
    competition_name: recognition.competition_name,
    display_order: recognition.display_order,
    logoUrl: supabase.storage.from('marketing-editorial').getPublicUrl(recognition.logo_path).data.publicUrl,
  }))
}
