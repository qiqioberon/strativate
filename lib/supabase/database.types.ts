export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type AppRole = "admin" | "mentor" | "mentee"
export type InstitutionType = "university" | "sma" | "smk"
export type ApprovalStatus = "approved" | "pending" | "rejected" | "archived"
export type RegistrationMethod = "email" | "google" | "invitation"
export type DigitalProductContentType = "pdf" | "video"

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
export type MarketingHeroPoster = {
  id: string
  image_path: string
  alt_text: string
  title: string | null
  url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}
export type DigitalProduct = {
  id: string
  name: string
  slug: string
  description: string
  image_path: string
  price_amount: number
  content_type: DigitalProductContentType | null
  content_path: string | null
  content_mime_type: string | null
  content_file_name: string | null
  content_size_bytes: number | null
  page_count: number | null
  duration_seconds: number | null
  is_published: boolean
  created_at: string
  updated_at: string
}
export type DigitalProductAccessSession = {
  id: string
  user_id: string
  product_id: string
  order_id: string | null
  order_item_id: string | null
  created_at: string
  expires_at: string
}
export type DigitalProductAccessGrant = {
  session_id: string
  product_id: string
  content_type: DigitalProductContentType
  content_path: string
  content_mime_type: string
  content_file_name: string | null
  order_id: string | null
  order_item_id: string | null
  expires_at: string
}
export type CommerceItem = {
  id: string
  item_kind: string
  is_available: boolean
  created_at: string
  updated_at: string
}
export type CartStatus = "active" | "converted"
export type Cart = {
  id: string
  user_id: string
  status: CartStatus
  created_at: string
  updated_at: string
}
export type CartItem = {
  id: string
  cart_id: string
  commerce_item_id: string
  created_at: string
}
export type CartItemView = {
  cart_id: string
  cart_item_id: string
  commerce_item_id: string
  item_kind: string
  name: string | null
  slug: string | null
  image_path: string | null
  price_amount: number | null
  is_available: boolean
  created_at: string
}
export type OrderStatus = "pending_payment" | "paid" | "payment_failed" | "expired" | "cancelled"
export type Order = {
  id: string
  user_id: string
  cart_id: string
  status: OrderStatus
  currency_code: "IDR"
  total_amount: number
  created_at: string
  updated_at: string
  paid_at: string | null
}
export type OrderItem = {
  id: string
  order_id: string
  commerce_item_id: string
  item_kind_snapshot: string
  name_snapshot: string
  slug_snapshot: string
  unit_price_amount: number
  created_at: string
}
export type PaymentAttemptStatus = "creating" | "pending" | "paid" | "failed" | "expired" | "cancelled"
export type PaymentAttempt = {
  id: string
  order_id: string
  provider: "midtrans"
  provider_order_id: string
  snap_token: string | null
  snap_token_created_at: string | null
  snap_token_expires_at: string | null
  snap_creation_claim_token: string | null
  snap_creation_claimed_at: string | null
  snap_creation_claim_expires_at: string | null
  provider_transaction_id: string | null
  provider_status: string | null
  fraud_status: string | null
  payment_type: string | null
  gross_amount: number
  status: PaymentAttemptStatus
  created_at: string
  updated_at: string
}
export type OwnedDigitalProduct = {
  order_item_id: string
  order_id: string
  commerce_item_id: string
  name_snapshot: string
  slug_snapshot: string
  unit_price_amount: number
  purchased_at: string
  current_image_path: string | null
}
export type MentorInvite = {
  email: string
  invited_by: string
  status: "pending" | "sent" | "failed"
  user_id: string | null
  tier_id: string | null
  created_at: string
  updated_at: string
}
export type MentorInviteSummary = Pick<MentorInvite, 'email' | 'status' | 'tier_id' | 'created_at'> & {
  tier_code: string | null
  tier_name: string | null
  can_delete: boolean
}
export type MentorTier = {
  id: string
  code: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}
export type MentorProfile = {
  user_id: string
  tier_id: string | null
  timezone: string
  is_active: boolean
  created_at: string
  updated_at: string
}
export type MentorAvailabilityRule = {
  id: string
  mentor_id: string
  week_start_date: string
  day_of_week: number
  start_time: string
  end_time: string
  created_at: string
  updated_at: string
}
export type ManagedMentor = {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  username: string | null
  avatar_url: string | null
  tier_id: string | null
  tier_code: string | null
  tier_name: string | null
  timezone: string
  is_active: boolean
  mentor_setup_completed_at: string | null
  created_at: string
  availability_configured: boolean
  availability_current_week_configured: boolean
  availability_next_week_configured: boolean
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
      marketing_hero_posters: Table<MarketingHeroPoster, Partial<MarketingHeroPoster> & Pick<MarketingHeroPoster, "image_path" | "alt_text">>
      digital_products: Table<DigitalProduct, Partial<DigitalProduct> & Pick<DigitalProduct, "name" | "slug" | "description" | "image_path" | "price_amount">>
      digital_product_access_sessions: Table<DigitalProductAccessSession, Partial<DigitalProductAccessSession> & Pick<DigitalProductAccessSession, "user_id" | "product_id">>
      commerce_items: Table<CommerceItem, Partial<CommerceItem> & Pick<CommerceItem, "id" | "item_kind">>
      carts: Table<Cart, Partial<Cart> & Pick<Cart, "user_id">>
      cart_items: Table<CartItem, Partial<CartItem> & Pick<CartItem, "cart_id" | "commerce_item_id">>
      orders: Table<Order, Partial<Order> & Pick<Order, "user_id" | "cart_id" | "total_amount">>
      order_items: Table<OrderItem, Partial<OrderItem> & Pick<OrderItem, "order_id" | "commerce_item_id" | "item_kind_snapshot" | "name_snapshot" | "slug_snapshot" | "unit_price_amount">>
      payment_attempts: Table<PaymentAttempt, Partial<PaymentAttempt> & Pick<PaymentAttempt, "order_id" | "provider" | "provider_order_id" | "gross_amount">>
      mentee_interests: Table<{ user_id: string; interest_id: string; created_at: string }, { user_id: string; interest_id: string; created_at?: string }>
      mentor_invites: Table<MentorInvite, Partial<MentorInvite> & Pick<MentorInvite, "email" | "invited_by">>
      mentor_tiers: Table<MentorTier, Partial<MentorTier> & Pick<MentorTier, "code" | "name">>
      mentor_profiles: Table<MentorProfile, Partial<MentorProfile> & Pick<MentorProfile, "user_id">>
      mentor_availability_rules: Table<MentorAvailabilityRule, Partial<MentorAvailabilityRule> & Pick<MentorAvailabilityRule, "mentor_id" | "week_start_date" | "day_of_week" | "start_time" | "end_time">>
    }
    Views: { [_ in never]: never }
    Functions: {
      list_mentor_invites: { Args: { p_offset?: number }; Returns: MentorInviteSummary[] }
      list_managed_mentors: { Args: { p_offset: number; p_query: string; p_tier_id: string | null; p_account_status: string; p_setup_status: string }; Returns: ManagedMentor[] }
      count_managed_mentors: { Args: { p_query: string; p_tier_id: string | null; p_account_status: string; p_setup_status: string }; Returns: number }
      set_mentor_tier: { Args: { p_mentor_id: string; p_tier_id: string }; Returns: MentorProfile }
      set_mentor_active: { Args: { p_mentor_id: string; p_is_active: boolean }; Returns: MentorProfile }
      save_mentor_availability: { Args: { p_mentor_id: string; p_week_start_date: string; p_rules: Json }; Returns: MentorAvailabilityRule[] }
      delete_mentor_account: { Args: { p_mentor_id: string }; Returns: undefined }
      delete_mentor_invite: { Args: { p_email: string }; Returns: undefined }
      import_institutions_batch: { Args: { p_rows: Json }; Returns: Json }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      save_onboarding_step: { Args: { p_step: number; p_data: Json }; Returns: MenteeProfile }
      submit_institution: { Args: { p_name: string; p_type: InstitutionType; p_allow_duplicate?: boolean }; Returns: Institution }
      search_institutions: { Args: { p_query: string }; Returns: Institution[] }
      complete_mentor_setup: { Args: { p_first_name: string; p_last_name: string; p_username: string }; Returns: Profile }
      merge_institutions: { Args: { p_from: string; p_into: string }; Returns: undefined }
      reorder_marketing_hero_posters: { Args: { p_ids: string[] }; Returns: undefined }
      get_or_create_active_cart: { Args: Record<PropertyKey, never>; Returns: Cart }
      add_cart_item: { Args: { p_commerce_item_id: string }; Returns: CartItem }
      remove_cart_item: { Args: { p_cart_item_id: string }; Returns: undefined }
      get_active_cart: { Args: Record<PropertyKey, never>; Returns: CartItemView[] }
      create_order_from_cart: { Args: { p_cart_id: string }; Returns: Order }
      list_owned_digital_products: { Args: Record<PropertyKey, never>; Returns: OwnedDigitalProduct[] }
      create_digital_product_access_session: { Args: { p_product_id: string }; Returns: DigitalProductAccessGrant[] }
      reserve_midtrans_payment_attempt: { Args: { p_order_id: string }; Returns: PaymentAttempt }
      claim_midtrans_snap_creation: { Args: { p_attempt_id: string; p_claim_token: string }; Returns: boolean }
      store_midtrans_snap_token: { Args: { p_attempt_id: string; p_claim_token: string; p_snap_token: string }; Returns: PaymentAttempt }
      release_midtrans_snap_creation: { Args: { p_attempt_id: string; p_claim_token: string }; Returns: boolean }
      apply_midtrans_payment_status: { Args: { p_attempt_id: string; p_normalized_status: string; p_provider_status: string; p_provider_transaction_id: string | null; p_fraud_status: string | null; p_payment_type: string | null }; Returns: PaymentAttempt }
    }
    Enums: {
      app_role: AppRole
      institution_type: InstitutionType
      institution_approval_status: ApprovalStatus
    }
    CompositeTypes: { [_ in never]: never }
  }
}