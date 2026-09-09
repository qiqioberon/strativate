export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type AppRole = "admin" | "mentor" | "mentee"
export type InstitutionType = "university" | "sma" | "smk"
export type ApprovalStatus = "approved" | "pending" | "rejected" | "archived"
export type RegistrationMethod = "email" | "google" | "invitation"
export type CatalogProductType = "private_mentoring" | "intensive_mentoring" | "big_class" | "digital_product"
export type CatalogLifecycleStatus = "draft" | "published" | "archived"
export type CatalogPurchaseFlow = "consultation_offer" | "direct_checkout"
export type CatalogPricingMode = "fixed" | "quotation_required"
export type CatalogCommercialItemKind = "offering" | "add_on" | "bundle"
export type CatalogDigitalContentType = "pdf" | "video"
export type CatalogDeliveryOptionKind = "learning_path" | "focus_topic"
export type CatalogIntensiveScope = "national_fixed" | "international_custom"

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
export type MentorInviteSummary = Pick<MentorInvite, 'email' | 'status' | 'created_at'> & { can_delete: boolean }
export type CatalogProduct = {
  id: string; code: string; slug: string; product_type: CatalogProductType; status: CatalogLifecycleStatus
  default_purchase_flow: CatalogPurchaseFlow; title: string; short_description: string; description: string | null
  is_public: boolean; is_featured: boolean; sort_order: number; published_at: string | null; archived_at: string | null
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string
}
export type CatalogCommercialItem = {
  id: string; product_id: string; code: string; kind: CatalogCommercialItemKind; status: CatalogLifecycleStatus
  title: string; description: string | null; pricing_mode: CatalogPricingMode | null; price_amount: number | null
  reference_price_amount: number | null; currency_code: string; is_sellable: boolean; sort_order: number
  published_at: string | null; archived_at: string | null; created_by: string | null; updated_by: string | null
  created_at: string; updated_at: string
}
export type CatalogAdminProduct = Omit<CatalogProduct, "created_by" | "updated_by">
export type CatalogAdminCommercialItem = Omit<CatalogCommercialItem, "created_by" | "updated_by">
export type CatalogOffering = { id: string; product_id: string; kind: "offering" }
export type CatalogAddOn = { id: string; product_id: string; kind: "add_on"; is_conditional: boolean; public_condition_summary: string | null }
export type CatalogBundle = { id: string; product_id: string; kind: "bundle"; is_conditional: boolean; public_condition_summary: string | null }
export type CatalogPrivateDetails = { product_id: string; product_type: "private_mentoring"; session_duration_minutes: number; min_participants: number; max_participants: number }
export type CatalogMentorTier = { id: string; product_id: string; product_type: "private_mentoring"; code: string; label: string; description: string | null; status: CatalogLifecycleStatus; sort_order: number; created_at: string; updated_at: string }
export type CatalogSessionPackage = { id: string; product_id: string; product_type: "private_mentoring"; code: string; label: string; session_count: number; status: CatalogLifecycleStatus; sort_order: number; created_at: string; updated_at: string }
export type CatalogPrivateOfferingConfig = { id: string; product_id: string; mentor_tier_id: string; session_package_id: string; per_session_price_amount: number }
export type CatalogIntensiveOfferingConfig = { id: string; product_id: string; product_type: "intensive_mentoring"; scope: CatalogIntensiveScope; sessions_per_month: number | null }
export type CatalogDigitalDetails = { product_id: string; product_type: "digital_product"; content_type: CatalogDigitalContentType }
export type CatalogDeliveryOption = { id: string; product_id: string; product_type: "private_mentoring"; kind: CatalogDeliveryOptionKind; code: string; label: string; allows_custom_value: boolean; status: CatalogLifecycleStatus; sort_order: number; created_at: string; updated_at: string }
export type CatalogBenefit = { id: string; product_id: string; code: string; label: string; description: string | null; status: CatalogLifecycleStatus; sort_order: number; created_at: string; updated_at: string }
export type CatalogOfferingBenefit = { product_id: string; offering_id: string; benefit_id: string }
export type CatalogAddOnApplicability = { product_id: string; add_on_id: string; offering_id: string }
export type CatalogBundleOffering = { product_id: string; bundle_id: string; offering_id: string; quantity: number }
export type CatalogBundleAddOn = { product_id: string; bundle_id: string; add_on_id: string; quantity: number }
export type CatalogBundleBenefit = { product_id: string; bundle_id: string; benefit_id: string; quantity: number }
export type PublicCatalogProduct = Omit<CatalogProduct, "status" | "is_public" | "published_at" | "archived_at" | "created_by" | "updated_by">
export type PublicCatalogCommercialItem = Pick<CatalogCommercialItem, "id" | "product_id" | "code" | "kind" | "title" | "description" | "pricing_mode" | "price_amount" | "reference_price_amount" | "currency_code" | "is_sellable" | "sort_order"> & { pricing_mode: CatalogPricingMode }
export type PublicCatalogPrivateOffering = { id: string; product_id: string; mentor_tier_id: string; mentor_tier_code: string; mentor_tier_label: string; session_package_id: string; session_package_code: string; session_package_label: string; session_count: number; per_session_price_amount: number; session_duration_minutes: number; min_participants: number; max_participants: number }
export type PublicCatalogIntensiveOffering = { id: string; product_id: string; scope: CatalogIntensiveScope; sessions_per_month: number | null }
export type PublicCatalogDeliveryOption = Pick<CatalogDeliveryOption, "id" | "product_id" | "kind" | "code" | "label" | "allows_custom_value" | "sort_order">
export type PublicCatalogItemBenefit = { product_id: string; item_id: string; item_code: string; benefit_id: string; benefit_code: string; benefit_label: string; benefit_description: string | null; sort_order: number }
export type PublicCatalogBundleComponent = { product_id: string; bundle_id: string; bundle_code: string; component_kind: "offering" | "add_on" | "benefit"; component_id: string; component_code: string; component_title: string; quantity: number }
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
      catalog_products: Table<CatalogProduct, Partial<CatalogProduct> & Pick<CatalogProduct, "code" | "slug" | "product_type" | "default_purchase_flow" | "title" | "short_description">>
      catalog_commercial_items: Table<CatalogCommercialItem, Partial<CatalogCommercialItem> & Pick<CatalogCommercialItem, "product_id" | "code" | "kind" | "title">>
      catalog_offerings: Table<CatalogOffering, CatalogOffering>
      catalog_add_ons: Table<CatalogAddOn, Partial<CatalogAddOn> & Pick<CatalogAddOn, "id" | "product_id">>
      catalog_bundles: Table<CatalogBundle, Partial<CatalogBundle> & Pick<CatalogBundle, "id" | "product_id">>
      catalog_private_mentoring_details: Table<CatalogPrivateDetails, Omit<CatalogPrivateDetails, "product_type"> & { product_type?: "private_mentoring" }>
      catalog_mentor_tiers: Table<CatalogMentorTier, Partial<CatalogMentorTier> & Pick<CatalogMentorTier, "product_id" | "code" | "label">>
      catalog_session_packages: Table<CatalogSessionPackage, Partial<CatalogSessionPackage> & Pick<CatalogSessionPackage, "product_id" | "code" | "label" | "session_count">>
      catalog_private_offering_configs: Table<CatalogPrivateOfferingConfig, CatalogPrivateOfferingConfig>
      catalog_intensive_offering_configs: Table<CatalogIntensiveOfferingConfig, Omit<CatalogIntensiveOfferingConfig, "product_type"> & { product_type?: "intensive_mentoring" }>
      catalog_digital_product_details: Table<CatalogDigitalDetails, Omit<CatalogDigitalDetails, "product_type"> & { product_type?: "digital_product" }>
      catalog_delivery_options: Table<CatalogDeliveryOption, Partial<CatalogDeliveryOption> & Pick<CatalogDeliveryOption, "product_id" | "kind" | "code" | "label">>
      catalog_benefits: Table<CatalogBenefit, Partial<CatalogBenefit> & Pick<CatalogBenefit, "product_id" | "code" | "label">>
      catalog_offering_benefits: Table<CatalogOfferingBenefit, CatalogOfferingBenefit>
      catalog_add_on_applicability: Table<CatalogAddOnApplicability, CatalogAddOnApplicability>
      catalog_bundle_offerings: Table<CatalogBundleOffering, Partial<CatalogBundleOffering> & Pick<CatalogBundleOffering, "product_id" | "bundle_id" | "offering_id">>
      catalog_bundle_add_ons: Table<CatalogBundleAddOn, Partial<CatalogBundleAddOn> & Pick<CatalogBundleAddOn, "product_id" | "bundle_id" | "add_on_id">>
      catalog_bundle_benefits: Table<CatalogBundleBenefit, Partial<CatalogBundleBenefit> & Pick<CatalogBundleBenefit, "product_id" | "bundle_id" | "benefit_id">>
    }
    Views: {
      public_catalog_products: { Row: PublicCatalogProduct; Relationships: [] }
      public_catalog_commercial_items: { Row: PublicCatalogCommercialItem; Relationships: [] }
      public_catalog_private_offerings: { Row: PublicCatalogPrivateOffering; Relationships: [] }
      public_catalog_intensive_offerings: { Row: PublicCatalogIntensiveOffering; Relationships: [] }
      public_catalog_add_ons: { Row: CatalogAddOn; Relationships: [] }
      public_catalog_bundles: { Row: CatalogBundle; Relationships: [] }
      public_catalog_delivery_options: { Row: PublicCatalogDeliveryOption; Relationships: [] }
      public_catalog_item_benefits: { Row: PublicCatalogItemBenefit; Relationships: [] }
      public_catalog_add_on_applicability: { Row: CatalogAddOnApplicability; Relationships: [] }
      public_catalog_bundle_components: { Row: PublicCatalogBundleComponent; Relationships: [] }
      public_catalog_digital_details: { Row: Pick<CatalogDigitalDetails, "product_id" | "content_type">; Relationships: [] }
    }
    Functions: {
      list_mentor_invites: { Args: { p_offset?: number }; Returns: MentorInviteSummary[] }
      delete_mentor_invite: { Args: { p_email: string }; Returns: undefined }
      import_institutions_batch: { Args: { p_rows: Json }; Returns: Json }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      save_onboarding_step: { Args: { p_step: number; p_data: Json }; Returns: MenteeProfile }
      submit_institution: { Args: { p_name: string; p_type: InstitutionType; p_allow_duplicate?: boolean }; Returns: Institution }
      search_institutions: { Args: { p_query: string }; Returns: Institution[] }
      complete_mentor_setup: { Args: { p_first_name: string; p_last_name: string; p_username: string }; Returns: Profile }
      merge_institutions: { Args: { p_from: string; p_into: string }; Returns: undefined }
      set_catalog_product_status: { Args: { p_product_id: string; p_status: CatalogLifecycleStatus }; Returns: CatalogProduct }
      set_catalog_commercial_item_status: { Args: { p_item_id: string; p_status: CatalogLifecycleStatus }; Returns: CatalogCommercialItem }
      create_catalog_commercial_item: { Args: {
        p_product_id: string; p_code: string; p_kind: CatalogCommercialItemKind; p_title: string
        p_description?: string | null; p_pricing_mode?: CatalogPricingMode | null; p_price_amount?: number | null
        p_reference_price_amount?: number | null; p_is_sellable?: boolean; p_sort_order?: number
        p_mentor_tier_id?: string | null; p_session_package_id?: string | null; p_per_session_price_amount?: number | null
        p_intensive_scope?: CatalogIntensiveScope | null; p_sessions_per_month?: number | null
        p_is_conditional?: boolean; p_public_condition_summary?: string | null
      }; Returns: string }
    }
    Enums: {
      app_role: AppRole; institution_type: InstitutionType; institution_approval_status: ApprovalStatus
      catalog_product_type: CatalogProductType; catalog_lifecycle_status: CatalogLifecycleStatus
      catalog_purchase_flow: CatalogPurchaseFlow; catalog_pricing_mode: CatalogPricingMode
      catalog_commercial_item_kind: CatalogCommercialItemKind; catalog_digital_content_type: CatalogDigitalContentType
      catalog_delivery_option_kind: CatalogDeliveryOptionKind; catalog_intensive_scope: CatalogIntensiveScope
    }
    CompositeTypes: { [_ in never]: never }
  }
}
