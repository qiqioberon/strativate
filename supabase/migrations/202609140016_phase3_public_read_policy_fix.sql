-- Phase 3 public editorial/package rows are intentionally readable when active.
-- Keep anonymous reads independent from the authenticated-only is_admin() helper.
-- Admin visibility for inactive rows is provided by separate authenticated policies.

drop policy if exists competition_categories_public_read on public.competition_categories;
drop policy if exists private_mentoring_programs_public_read on public.private_mentoring_programs;
drop policy if exists private_mentoring_highlights_public_read on public.private_mentoring_highlights;
drop policy if exists private_mentoring_journey_public_read on public.private_mentoring_journey_steps;
drop policy if exists private_mentoring_learning_paths_public_read on public.private_mentoring_learning_paths;
drop policy if exists private_mentoring_focuses_public_read on public.private_mentoring_session_focuses;
drop policy if exists private_mentoring_packages_public_read on public.private_mentoring_packages;

create policy competition_categories_public_read
on public.competition_categories for select to anon, authenticated
using (is_active);

create policy private_mentoring_programs_public_read
on public.private_mentoring_programs for select to anon, authenticated
using (is_active);

create policy private_mentoring_highlights_public_read
on public.private_mentoring_highlights for select to anon, authenticated
using (is_active);

create policy private_mentoring_journey_public_read
on public.private_mentoring_journey_steps for select to anon, authenticated
using (is_active);

create policy private_mentoring_learning_paths_public_read
on public.private_mentoring_learning_paths for select to anon, authenticated
using (is_active);

create policy private_mentoring_focuses_public_read
on public.private_mentoring_session_focuses for select to anon, authenticated
using (is_active);

create policy private_mentoring_packages_public_read
on public.private_mentoring_packages for select to anon, authenticated
using (is_active);

create policy competition_categories_admin_read
on public.competition_categories for select to authenticated
using (public.is_admin());

create policy private_mentoring_programs_admin_read
on public.private_mentoring_programs for select to authenticated
using (public.is_admin());

create policy private_mentoring_highlights_admin_read
on public.private_mentoring_highlights for select to authenticated
using (public.is_admin());

create policy private_mentoring_journey_admin_read
on public.private_mentoring_journey_steps for select to authenticated
using (public.is_admin());

create policy private_mentoring_learning_paths_admin_read
on public.private_mentoring_learning_paths for select to authenticated
using (public.is_admin());

create policy private_mentoring_focuses_admin_read
on public.private_mentoring_session_focuses for select to authenticated
using (public.is_admin());

create policy private_mentoring_packages_admin_read
on public.private_mentoring_packages for select to authenticated
using (public.is_admin());
