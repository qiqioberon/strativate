export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type AppRole = "admin" | "mentor" | "mentee"
export type InstitutionType = "university" | "sma" | "smk"
export type ApprovalStatus = "approved" | "pending" | "rejected" | "archived"
export type RegistrationMethod = "email" | "google" | "invitation"

export type Profile = {
  id: string
  role: AppRole
  first_name: string | null
  last_name: string | null
  username: string | null
  avatar_url: string | null
  registration_method: RegistrationMethod
  mentor_setup_completed_at: string | null
  password_set_at: string | null
  created_at: string
  updated_at: string
}
export type MenteeProfile = {
  user_id: string
  institution_id: string | null
  major_or_faculty: string | null
  cohort_year: number | null
  referral_source_id: string | null
  referral_other_text: string | null
  other_interest_text: string | null
  onboarding_step: number
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}
export type Institution = {
  id: string
  name: string
  normalized_name: string
  type: InstitutionType
  province: string | null
  city: string | null
  external_id: string | null
  source: string
  source_url: string | null
  approval_status: ApprovalStatus
  institution_status: string | null
  submitted_by: string | null
  created_at: string
  updated_at: string
}
export type MasterOption = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}
export type MentorInvite = {
  email: string
  invited_by: string
  status: "pending" | "sent" | "failed"
  user_id: string | null
  created_at: string
  updated_at: string
}
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Partial<Profile> & Pick<Profile, "id" | "registration_method">>
      mentee_profiles: Table<MenteeProfile, Partial<MenteeProfile> & Pick<MenteeProfile, "user_id">>
      institutions: Table<Institution, Partial<Institution> & Pick<Institution, "name" | "type" | "source">>
      referral_sources: Table<MasterOption, Partial<MasterOption> & Pick<MasterOption, "name">>
      interests: Table<MasterOption, Partial<MasterOption> & Pick<MasterOption, "name">>
      mentee_interests: Table<{ user_id: string; interest_id: string; created_at: string }, { user_id: string; interest_id: string; created_at?: string }>
      mentor_invites: Table<MentorInvite, Partial<MentorInvite> & Pick<MentorInvite, "email" | "invited_by">>
    }
    Views: { [_ in never]: never }
    Functions: {
      import_institutions_batch: { Args: { p_rows: Json }; Returns: Json }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      save_onboarding_step: { Args: { p_step: number; p_data: Json }; Returns: MenteeProfile }
      submit_institution: { Args: { p_name: string; p_type: InstitutionType; p_allow_duplicate?: boolean }; Returns: Institution }
      search_institutions: { Args: { p_query: string }; Returns: Institution[] }
      complete_mentor_setup: { Args: { p_first_name: string; p_last_name: string; p_username: string }; Returns: Profile }
      merge_institutions: { Args: { p_from: string; p_into: string }; Returns: undefined }
    }
    Enums: { app_role: AppRole; institution_type: InstitutionType; institution_approval_status: ApprovalStatus }
    CompositeTypes: { [_ in never]: never }
  }
}
