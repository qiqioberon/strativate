-- Execute as postgres after migrations. All fixtures roll back.
begin;
create schema test_testimonials;
grant usage on schema test_testimonials to anon, authenticated;

create function test_testimonials.assert(p_condition boolean, p_message text) returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %', p_message; end if;
end $$;

create function test_testimonials.denied(p_sql text, p_message text) returns void language plpgsql as $$
declare
  rejected boolean := false;
  affected bigint := 0;
begin
  begin
    execute p_sql;
    get diagnostics affected = row_count;
    rejected := affected = 0;
  exception when insufficient_privilege or check_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'ATTACK ACCEPTED: %', p_message; end if;
end $$;
grant execute on all functions in schema test_testimonials to anon, authenticated;

insert into auth.users (id, email, encrypted_password) values
  ('94000000-0000-0000-0000-000000000001', 'testimonial-admin@test.invalid', 'hash'),
  ('94000000-0000-0000-0000-000000000002', 'testimonial-mentee@test.invalid', 'hash');
update public.profiles set role = 'admin' where id = '94000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000001', true);
insert into public.marketing_testimonials
  (slug, competition_name, achievement, testimonial, image_path, sort_order, is_published)
values
  ('visible-story', 'Visible Competition', '1st Place', 'Visible testimonial', 'testimonials/visible.webp', 10, true),
  ('draft-story', 'Draft Competition', 'Finalist', 'Draft testimonial', null, 20, true);
insert into storage.objects (bucket_id, name, owner_id)
values ('marketing-testimonials', 'testimonials/visible.webp', '94000000-0000-0000-0000-000000000001');
select public.reorder_marketing_testimonials(array(select id from public.marketing_testimonials order by sort_order desc));
select test_testimonials.assert((select sort_order = 1 from public.marketing_testimonials where slug = 'draft-story'), 'admin can reorder testimonials');
select test_testimonials.assert(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_testimonials'
      and column_name in ('participant_label', 'alt_text')
  ),
  'removed testimonial metadata columns stay absent'
);
reset role;

set local role anon;
select test_testimonials.assert((select count(*) = 1 from public.marketing_testimonials), 'anonymous users only see published testimonials with images');
select test_testimonials.assert((select count(*) = 1 from storage.objects where bucket_id = 'marketing-testimonials'), 'testimonial image is publicly readable');
select test_testimonials.denied($q$insert into public.marketing_testimonials (slug, competition_name, achievement, testimonial) values ('attack', 'Attack', 'Attack', 'Attack')$q$, 'anonymous testimonial insert');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000002', true);
select test_testimonials.assert((select count(*) = 1 from public.marketing_testimonials), 'mentee only sees public testimonial rows');
select test_testimonials.denied($q$update public.marketing_testimonials set achievement = 'tampered'$q$, 'mentee testimonial update');
select test_testimonials.denied($q$insert into storage.objects (bucket_id, name, owner_id) values ('marketing-testimonials', 'testimonials/attack.webp', '94000000-0000-0000-0000-000000000002')$q$, 'mentee testimonial upload');
reset role;

rollback;
select 'PASS: marketing testimonial table and storage policy security' as result;
