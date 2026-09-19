-- Preserve the full testimonial photo for the detail modal while image_path remains the 4:5 gallery crop.

alter table public.marketing_testimonials
  add column if not exists original_image_path text unique check (
    original_image_path is null or (
      char_length(original_image_path) between 13 and 508
      and original_image_path ~ '^testimonials/[A-Za-z0-9][A-Za-z0-9._/-]*$'
      and original_image_path !~ '(^|/)\.\.(/|$)'
    )
  );

revoke all on public.marketing_testimonials from anon, authenticated;

grant select (
  id,
  slug,
  competition_name,
  achievement,
  testimonial,
  image_path,
  original_image_path,
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
  original_image_path,
  sort_order,
  is_published
), update (
  slug,
  competition_name,
  achievement,
  testimonial,
  image_path,
  original_image_path,
  sort_order,
  is_published
), delete on public.marketing_testimonials to authenticated;
