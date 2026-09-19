-- Remove testimonial metadata that is no longer admin-managed.
-- Accessibility alt text is derived from competition_name in the application.
-- participant_label is no longer part of the testimonial content model.

alter table public.marketing_testimonials
  drop column if exists participant_label,
  drop column if exists alt_text;

revoke all on public.marketing_testimonials from anon, authenticated;

grant select (
  id,
  slug,
  competition_name,
  achievement,
  testimonial,
  image_path,
  sort_order,
  is_published,
  created_at,
  updated_at
) on public.marketing_testimonials to anon, authenticated;

grant insert (
  slug,
  competition_name,
  achievement,
  testimonial,
  image_path,
  sort_order,
  is_published
), update (
  slug,
  competition_name,
  achievement,
  testimonial,
  image_path,
  sort_order,
  is_published
), delete on public.marketing_testimonials to authenticated;
