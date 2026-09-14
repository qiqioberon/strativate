-- Remove the abandoned generic Product Catalog Master.
-- This is intentionally explicit and forward-only. Never replace these drops with CASCADE.

-- Abort before destructive work if a non-catalog table acquired an FK into the legacy catalog.
do $$
declare
  external_dependencies text;
begin
  select string_agg(format('%I.%I via %I', source_ns.nspname, source.relname, c.conname), ', ' order by source_ns.nspname, source.relname, c.conname)
    into external_dependencies
  from pg_constraint c
  join pg_class target on target.oid = c.confrelid
  join pg_namespace target_ns on target_ns.oid = target.relnamespace
  join pg_class source on source.oid = c.conrelid
  join pg_namespace source_ns on source_ns.oid = source.relnamespace
  where c.contype = 'f'
    and target_ns.nspname = 'public'
    and target.relname = any(array[
      'catalog_products','catalog_commercial_items','catalog_offerings','catalog_add_ons','catalog_bundles',
      'catalog_private_mentoring_details','catalog_mentor_tiers','catalog_session_packages',
      'catalog_private_offering_configs','catalog_intensive_offering_configs','catalog_digital_product_details',
      'catalog_delivery_options','catalog_benefits','catalog_offering_benefits','catalog_add_on_applicability',
      'catalog_bundle_offerings','catalog_bundle_add_ons','catalog_bundle_benefits'
    ])
    and not (
      source_ns.nspname = 'public'
      and source.relname = any(array[
        'catalog_products','catalog_commercial_items','catalog_offerings','catalog_add_ons','catalog_bundles',
        'catalog_private_mentoring_details','catalog_mentor_tiers','catalog_session_packages',
        'catalog_private_offering_configs','catalog_intensive_offering_configs','catalog_digital_product_details',
        'catalog_delivery_options','catalog_benefits','catalog_offering_benefits','catalog_add_on_applicability',
        'catalog_bundle_offerings','catalog_bundle_add_ons','catalog_bundle_benefits'
      ])
    );

  if external_dependencies is not null then
    raise exception 'Legacy Product Catalog has non-catalog foreign-key dependencies: %', external_dependencies;
  end if;
end
$$;

-- Public views depend on catalog tables and must go first.
drop view if exists public.public_catalog_digital_details;
drop view if exists public.public_catalog_bundle_components;
drop view if exists public.public_catalog_add_on_applicability;
drop view if exists public.public_catalog_item_benefits;
drop view if exists public.public_catalog_delivery_options;
drop view if exists public.public_catalog_bundles;
drop view if exists public.public_catalog_add_ons;
drop view if exists public.public_catalog_intensive_offerings;
drop view if exists public.public_catalog_private_offerings;
drop view if exists public.public_catalog_commercial_items;
drop view if exists public.public_catalog_products;

-- Public/admin catalog RPCs depend on row types and enums owned by this system.
drop function if exists public.create_catalog_commercial_item(
  uuid, public.catalog_commercial_item_kind, text, text, text,
  public.catalog_pricing_mode, bigint, bigint, boolean, integer,
  uuid, uuid, bigint, public.catalog_intensive_scope, integer, boolean, text
);
drop function if exists public.set_catalog_product_status(uuid, public.catalog_lifecycle_status);
drop function if exists public.set_catalog_commercial_item_status(uuid, public.catalog_lifecycle_status);
drop function if exists public.catalog_validate_commercial_item(uuid);

-- Triggers are removed explicitly so helper functions can be dropped without CASCADE.
drop trigger if exists catalog_products_audit on public.catalog_products;
drop trigger if exists catalog_items_audit on public.catalog_commercial_items;
drop trigger if exists catalog_products_identity on public.catalog_products;
drop trigger if exists catalog_items_identity on public.catalog_commercial_items;
drop trigger if exists catalog_mentor_tiers_touch on public.catalog_mentor_tiers;
drop trigger if exists catalog_session_packages_touch on public.catalog_session_packages;
drop trigger if exists catalog_delivery_options_touch on public.catalog_delivery_options;
drop trigger if exists catalog_benefits_touch on public.catalog_benefits;
drop trigger if exists catalog_mentor_tiers_identity on public.catalog_mentor_tiers;
drop trigger if exists catalog_session_packages_identity on public.catalog_session_packages;
drop trigger if exists catalog_delivery_options_identity on public.catalog_delivery_options;
drop trigger if exists catalog_benefits_identity on public.catalog_benefits;
drop trigger if exists catalog_offerings_identity on public.catalog_offerings;
drop trigger if exists catalog_add_ons_identity on public.catalog_add_ons;
drop trigger if exists catalog_bundles_identity on public.catalog_bundles;
drop trigger if exists catalog_private_configs_identity on public.catalog_private_offering_configs;
drop trigger if exists catalog_intensive_configs_identity on public.catalog_intensive_offering_configs;
drop trigger if exists catalog_digital_details_identity on public.catalog_digital_product_details;
drop trigger if exists catalog_offerings_delete_guard on public.catalog_offerings;
drop trigger if exists catalog_add_ons_delete_guard on public.catalog_add_ons;
drop trigger if exists catalog_bundles_delete_guard on public.catalog_bundles;
drop trigger if exists catalog_private_configs_delete_guard on public.catalog_private_offering_configs;
drop trigger if exists catalog_intensive_configs_delete_guard on public.catalog_intensive_offering_configs;
drop trigger if exists catalog_private_details_delete_guard on public.catalog_private_mentoring_details;
drop trigger if exists catalog_digital_details_delete_guard on public.catalog_digital_product_details;
drop trigger if exists catalog_products_delete_guard on public.catalog_products;
drop trigger if exists catalog_items_delete_guard on public.catalog_commercial_items;
drop trigger if exists catalog_mentor_tiers_delete_guard on public.catalog_mentor_tiers;
drop trigger if exists catalog_session_packages_delete_guard on public.catalog_session_packages;
drop trigger if exists catalog_delivery_options_delete_guard on public.catalog_delivery_options;
drop trigger if exists catalog_benefits_delete_guard on public.catalog_benefits;
drop trigger if exists catalog_offering_benefits_draft on public.catalog_offering_benefits;
drop trigger if exists catalog_add_on_applicability_draft on public.catalog_add_on_applicability;
drop trigger if exists catalog_bundle_offerings_draft on public.catalog_bundle_offerings;
drop trigger if exists catalog_bundle_add_ons_draft on public.catalog_bundle_add_ons;
drop trigger if exists catalog_bundle_benefits_draft on public.catalog_bundle_benefits;
drop trigger if exists catalog_items_validate_published on public.catalog_commercial_items;

-- Explicit catalog policies. They are table-owned, but naming them here keeps the teardown auditable.
drop policy if exists catalog_products_public_read on public.catalog_products;
drop policy if exists catalog_products_admin_read on public.catalog_products;
drop policy if exists catalog_products_admin_insert on public.catalog_products;
drop policy if exists catalog_products_admin_update on public.catalog_products;
drop policy if exists catalog_products_admin_delete on public.catalog_products;
drop policy if exists catalog_items_public_read on public.catalog_commercial_items;
drop policy if exists catalog_items_admin_read on public.catalog_commercial_items;
drop policy if exists catalog_items_admin_insert on public.catalog_commercial_items;
drop policy if exists catalog_items_admin_update on public.catalog_commercial_items;
drop policy if exists catalog_items_admin_delete on public.catalog_commercial_items;

drop policy if exists catalog_offerings_admin_all on public.catalog_offerings;
drop policy if exists catalog_add_ons_admin_all on public.catalog_add_ons;
drop policy if exists catalog_bundles_admin_all on public.catalog_bundles;
drop policy if exists catalog_private_mentoring_details_admin_all on public.catalog_private_mentoring_details;
drop policy if exists catalog_mentor_tiers_admin_all on public.catalog_mentor_tiers;
drop policy if exists catalog_session_packages_admin_all on public.catalog_session_packages;
drop policy if exists catalog_private_offering_configs_admin_all on public.catalog_private_offering_configs;
drop policy if exists catalog_intensive_offering_configs_admin_all on public.catalog_intensive_offering_configs;
drop policy if exists catalog_digital_product_details_admin_all on public.catalog_digital_product_details;
drop policy if exists catalog_delivery_options_admin_all on public.catalog_delivery_options;
drop policy if exists catalog_benefits_admin_all on public.catalog_benefits;
drop policy if exists catalog_offering_benefits_admin_all on public.catalog_offering_benefits;
drop policy if exists catalog_add_on_applicability_admin_all on public.catalog_add_on_applicability;
drop policy if exists catalog_bundle_offerings_admin_all on public.catalog_bundle_offerings;
drop policy if exists catalog_bundle_add_ons_admin_all on public.catalog_bundle_add_ons;
drop policy if exists catalog_bundle_benefits_admin_all on public.catalog_bundle_benefits;

drop policy if exists catalog_offerings_public_read on public.catalog_offerings;
drop policy if exists catalog_add_ons_public_read on public.catalog_add_ons;
drop policy if exists catalog_bundles_public_read on public.catalog_bundles;
drop policy if exists catalog_private_details_public_read on public.catalog_private_mentoring_details;
drop policy if exists catalog_tiers_public_read on public.catalog_mentor_tiers;
drop policy if exists catalog_packages_public_read on public.catalog_session_packages;
drop policy if exists catalog_private_configs_public_read on public.catalog_private_offering_configs;
drop policy if exists catalog_intensive_configs_public_read on public.catalog_intensive_offering_configs;
drop policy if exists catalog_digital_details_public_read on public.catalog_digital_product_details;
drop policy if exists catalog_delivery_public_read on public.catalog_delivery_options;
drop policy if exists catalog_benefits_public_read on public.catalog_benefits;
drop policy if exists catalog_offering_benefits_public_read on public.catalog_offering_benefits;
drop policy if exists catalog_applicability_public_read on public.catalog_add_on_applicability;
drop policy if exists catalog_bundle_offerings_public_read on public.catalog_bundle_offerings;
drop policy if exists catalog_bundle_add_ons_public_read on public.catalog_bundle_add_ons;
drop policy if exists catalog_bundle_benefits_public_read on public.catalog_bundle_benefits;

-- Catalog-only indexes.
drop index if exists public.catalog_products_public_order;
drop index if exists public.catalog_items_product_order;
drop index if exists public.catalog_delivery_product_order;
drop index if exists public.catalog_benefits_product_order;

-- Relationship/composition tables before their referenced definitions and subtype tables.
drop table if exists public.catalog_bundle_benefits;
drop table if exists public.catalog_bundle_add_ons;
drop table if exists public.catalog_bundle_offerings;
drop table if exists public.catalog_add_on_applicability;
drop table if exists public.catalog_offering_benefits;
drop table if exists public.catalog_private_offering_configs;
drop table if exists public.catalog_intensive_offering_configs;
drop table if exists public.catalog_digital_product_details;
drop table if exists public.catalog_private_mentoring_details;
drop table if exists public.catalog_delivery_options;
drop table if exists public.catalog_benefits;
drop table if exists public.catalog_session_packages;
drop table if exists public.catalog_mentor_tiers;
drop table if exists public.catalog_bundles;
drop table if exists public.catalog_add_ons;
drop table if exists public.catalog_offerings;
drop table if exists public.catalog_commercial_items;
drop table if exists public.catalog_products;

-- Trigger helper functions are no longer referenced once catalog triggers/tables are gone.
drop function if exists public.catalog_validate_published_item_trigger();
drop function if exists public.catalog_require_draft_composition();
drop function if exists public.catalog_protect_deletion();
drop function if exists public.catalog_protect_structure_deletion();
drop function if exists public.catalog_protect_typed_structure();
drop function if exists public.catalog_protect_definition_identity();
drop function if exists public.catalog_protect_identity();
drop function if exists public.catalog_set_audit_fields();

-- Legacy enums last, after every table/function signature using them is gone.
drop type if exists public.catalog_intensive_scope;
drop type if exists public.catalog_delivery_option_kind;
drop type if exists public.catalog_digital_content_type;
drop type if exists public.catalog_commercial_item_kind;
drop type if exists public.catalog_pricing_mode;
drop type if exists public.catalog_purchase_flow;
drop type if exists public.catalog_lifecycle_status;
drop type if exists public.catalog_product_type;
