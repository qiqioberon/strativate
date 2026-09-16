-- Public mentor profile domain and Mentor Expertise master data.
-- This is intentionally separate from public.mentor_profiles, which remains the
-- canonical operational mentor-account domain for tier, timezone and availability.

create table public.mentor_public_profiles (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid unique references public.mentor_profiles(user_id) on delete set null,
  public_slug text not null unique
    check (public_slug = btrim(public_slug) and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(public_slug) between 1 and 120),
  display_name text not null
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 120),
  tier_id uuid references public.mentor_tiers(id) on delete restrict,
  headline text check (headline is null or (headline = btrim(headline) and char_length(headline) between 1 and 180)),
  linkedin_url text check (linkedin_url is null or (linkedin_url = btrim(linkedin_url) and char_length(linkedin_url) <= 2048 and linkedin_url ~ '^https?://')),
  short_bio text check (short_bio is null or (short_bio = btrim(short_bio) and char_length(short_bio) between 1 and 1200)),
  portrait_asset_key text check (portrait_asset_key is null or (portrait_asset_key = btrim(portrait_asset_key) and char_length(portrait_asset_key) between 1 and 180)),
  portrait_url text check (portrait_url is null or (portrait_url = btrim(portrait_url) and char_length(portrait_url) <= 2048 and portrait_url ~ '^https?://')),
  photo_status text not null default 'missing' check (photo_status in ('ready', 'missing')),
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mentor_public_profiles_public_order_idx
  on public.mentor_public_profiles(publication_status, sort_order, public_slug);
create index mentor_public_profiles_tier_idx on public.mentor_public_profiles(tier_id);

create table public.mentor_public_achievements (
  id uuid primary key default gen_random_uuid(),
  mentor_public_profile_id uuid not null references public.mentor_public_profiles(id) on delete cascade,
  achievement text not null
    check (achievement = btrim(achievement) and char_length(achievement) between 1 and 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mentor_public_profile_id, achievement)
);
create index mentor_public_achievements_profile_order_idx
  on public.mentor_public_achievements(mentor_public_profile_id, sort_order, id);

create table public.mentor_expertise (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  slug text not null unique
    check (slug = btrim(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 1 and 100),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index mentor_expertise_name_ci_unique on public.mentor_expertise(lower(name));
create index mentor_expertise_order_idx on public.mentor_expertise(sort_order, name);

create table public.mentor_public_profile_expertise (
  mentor_public_profile_id uuid not null references public.mentor_public_profiles(id) on delete cascade,
  expertise_id uuid not null references public.mentor_expertise(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (mentor_public_profile_id, expertise_id)
);
create index mentor_public_profile_expertise_expertise_idx
  on public.mentor_public_profile_expertise(expertise_id, mentor_public_profile_id);

create trigger mentor_public_profiles_touch_updated_at before update on public.mentor_public_profiles
  for each row execute function public.touch_updated_at();
create trigger mentor_public_achievements_touch_updated_at before update on public.mentor_public_achievements
  for each row execute function public.touch_updated_at();
create trigger mentor_expertise_touch_updated_at before update on public.mentor_expertise
  for each row execute function public.touch_updated_at();

-- Stable expertise identities. Rename operations preserve slug.
insert into public.mentor_expertise (id, name, slug, sort_order, is_active) values
  ('82000000-0000-0000-0000-000000000001', 'Lintas kategori kompetisi', 'lintas-kategori-kompetisi', 10, true),
  ('82000000-0000-0000-0000-000000000002', 'Business Plan', 'business-plan', 20, true),
  ('82000000-0000-0000-0000-000000000003', 'Business Case', 'business-case', 30, true),
  ('82000000-0000-0000-0000-000000000004', 'Marketing', 'marketing', 40, true),
  ('82000000-0000-0000-0000-000000000005', 'Finance', 'finance', 50, true),
  ('82000000-0000-0000-0000-000000000006', 'Economics', 'economics', 60, true),
  ('82000000-0000-0000-0000-000000000007', 'Accounting', 'accounting', 70, true),
  ('82000000-0000-0000-0000-000000000008', 'Proposal Development', 'proposal-development', 80, true)
on conflict (slug) do nothing;

-- Seed transport is temporary only; normalized tables remain the persistent source.
create temporary table mentor_public_roster_seed (
  id uuid primary key,
  public_slug text not null,
  display_name text not null,
  tier_name text,
  headline text,
  achievements jsonb not null,
  expertise_slugs jsonb not null,
  linkedin_url text,
  portrait_asset_key text not null,
  photo_status text not null,
  sort_order integer not null
) on commit drop;

insert into mentor_public_roster_seed
select
  x.id::uuid, x.public_slug, x.display_name, x.tier_name, x.headline,
  x.achievements, x.expertise_slugs, x.linkedin_url, x.portrait_asset_key,
  x.photo_status, x.sort_order
from jsonb_to_recordset($roster$
[
 {"id":"83000000-0000-0000-0000-000000000001","public_slug":"navira-putri","display_name":"Navira Putri","tier_name":"Young Professional","headline":"Senior Associate Consultant at Altha Consulting","achievements":["Co-Founder Strativate","Next Generation Women Leaders Asia Pacific 2026 — McKinsey & Company","Winner of 30+ business and research competitions"],"expertise_slugs":["lintas-kategori-kompetisi"],"linkedin_url":"https://www.linkedin.com/in/navira-putri-apriliani-063476207/","portrait_asset_key":"mentors.navira-putri.portrait","photo_status":"ready","sort_order":10},
 {"id":"83000000-0000-0000-0000-000000000002","public_slug":"safira-aulia","display_name":"Safira Aulia","tier_name":"Young Professional","headline":"Associate Finance Graduate Program at Grab","achievements":["Highest GPA in Management, FEB Universitas Indonesia 2024","Former Case Team Assistant at Boston Consulting Group","Winner of 30+ business case competitions"],"expertise_slugs":["finance"],"linkedin_url":"https://www.linkedin.com/in/safiraaulia5/","portrait_asset_key":"mentors.safira-aulia.portrait","photo_status":"ready","sort_order":20},
 {"id":"83000000-0000-0000-0000-000000000003","public_slug":"aqil-drajat","display_name":"Aqil Drajat","tier_name":"Young Professional","headline":"Key Account Executive at LUXASIA ID","achievements":["1st Most Outstanding Student Vocational UI 2024","L’Oréal Brandstorm Favorite Winner 2024","Winner of 10+ business and marketing competitions"],"expertise_slugs":["marketing","business-plan"],"linkedin_url":"https://www.linkedin.com/in/aqildrajat/","portrait_asset_key":"mentors.aqil-drajat.portrait","photo_status":"ready","sort_order":30},
 {"id":"83000000-0000-0000-0000-000000000004","public_slug":"ilham-hakim","display_name":"Ilham Hakim","tier_name":"Young Professional","headline":null,"achievements":["Winner of 10+ business competitions"],"expertise_slugs":["business-plan","business-case","marketing"],"linkedin_url":"https://www.linkedin.com/in/ilhamlh/","portrait_asset_key":"mentors.ilham-hakim.portrait","photo_status":"ready","sort_order":40},
 {"id":"83000000-0000-0000-0000-000000000005","public_slug":"rohananda-devi","display_name":"Rohananda Devi","tier_name":"Young Professional","headline":null,"achievements":["Winner of 5 business competitions"],"expertise_slugs":["lintas-kategori-kompetisi"],"linkedin_url":"https://www.linkedin.com/in/rohanandadevi/","portrait_asset_key":"mentors.rohananda-devi.portrait","photo_status":"ready","sort_order":50},
 {"id":"83000000-0000-0000-0000-000000000006","public_slug":"ratna-puspa","display_name":"Ratna Puspa","tier_name":"Young Professional","headline":null,"achievements":["Winner of 10+ business competitions"],"expertise_slugs":["business-case"],"linkedin_url":"https://www.linkedin.com/in/ratnapuspaamelia/","portrait_asset_key":"mentors.ratna-puspa.portrait","photo_status":"ready","sort_order":60},
 {"id":"83000000-0000-0000-0000-000000000007","public_slug":"ivonne-qiu","display_name":"Ivonne Qiu","tier_name":"Young Professional","headline":null,"achievements":["Winner of 5+ business competitions"],"expertise_slugs":["business-case","economics","finance"],"linkedin_url":null,"portrait_asset_key":"mentors.ivonne-qiu.portrait","photo_status":"missing","sort_order":70},
 {"id":"83000000-0000-0000-0000-000000000008","public_slug":"fajri-alan","display_name":"Fajri Alan","tier_name":"Young Professional","headline":null,"achievements":["Winner of 5+ business competitions"],"expertise_slugs":["business-case","finance","accounting"],"linkedin_url":null,"portrait_asset_key":"mentors.fajri-alan.portrait","photo_status":"missing","sort_order":80},
 {"id":"83000000-0000-0000-0000-000000000009","public_slug":"deanna","display_name":"Deanna","tier_name":"Young Professional","headline":null,"achievements":["Winner of 5+ business competitions"],"expertise_slugs":["business-plan","business-case","marketing"],"linkedin_url":null,"portrait_asset_key":"mentors.deanna.portrait","photo_status":"missing","sort_order":90},
 {"id":"83000000-0000-0000-0000-000000000010","public_slug":"cherien-stevie","display_name":"Cherien Stevie","tier_name":"Top Student","headline":"Market Research Intern at Wordpanel","achievements":["The Most Potential Student FEB UI 2026","NUS NOC Student Awardee","Winner of 20+ business competitions"],"expertise_slugs":["marketing","finance","business-plan"],"linkedin_url":"https://www.linkedin.com/in/cherien-stevie/","portrait_asset_key":"mentors.cherien-stevie.portrait","photo_status":"ready","sort_order":100},
 {"id":"83000000-0000-0000-0000-000000000011","public_slug":"m-iqbal-banoza","display_name":"M. Iqbal Banoza","tier_name":"Young Professional","headline":"Management Trainee at BCA Life","achievements":["Top 3 Mahasiswa Berprestasi Universitas Indonesia 2025","Winner of 30+ business and research competitions","Founder and Chief of National Debate Community Center"],"expertise_slugs":["business-plan","business-case","marketing","proposal-development"],"linkedin_url":"https://www.linkedin.com/in/m-iqbal-banoza/","portrait_asset_key":"mentors.m-iqbal-banoza.portrait","photo_status":"ready","sort_order":110},
 {"id":"83000000-0000-0000-0000-000000000012","public_slug":"terry-kuron","display_name":"Terry Kuron","tier_name":"Young Professional","headline":"Relations at PT Pertamina Hulu Indonesia","achievements":["Founder of Dear You Planner","1st Winner — National Marketing Plan Competition 2024","Winner of 10+ business and marketing competitions"],"expertise_slugs":["business-plan","business-case","marketing","proposal-development"],"linkedin_url":"https://www.linkedin.com/in/terry29/","portrait_asset_key":"mentors.terry-kuron.portrait","photo_status":"missing","sort_order":120},
 {"id":"83000000-0000-0000-0000-000000000013","public_slug":"akmal-faqih","display_name":"Akmal Faqih","tier_name":"Top Student","headline":null,"achievements":["Winner of 10+ business and marketing competitions"],"expertise_slugs":["business-case","finance"],"linkedin_url":"https://www.linkedin.com/in/akmal-faqih-567131247/","portrait_asset_key":"mentors.akmal-faqih.portrait","photo_status":"ready","sort_order":130},
 {"id":"83000000-0000-0000-0000-000000000014","public_slug":"syona-hana","display_name":"Syona Hana","tier_name":"Top Student","headline":"Shopee Apprenticeship Program — Business Development","achievements":["Director of Consulting at 180 Degrees Consulting UI","1st Place — Mahasiswa Berprestasi FTUI, Business Category 2025","Winner of 30+ business and research competitions"],"expertise_slugs":["business-plan","business-case","marketing","proposal-development"],"linkedin_url":"https://www.linkedin.com/in/syonahana/","portrait_asset_key":"mentors.syona-hana.portrait","photo_status":"ready","sort_order":140},
 {"id":"83000000-0000-0000-0000-000000000015","public_slug":"lubna-qumilaila","display_name":"Lubna Qumilaila","tier_name":"Young Professional","headline":"SAP Student Training and Rotation (STAR) Program","achievements":["President of 180 Degrees Consulting UI 2026","CIMB Niaga Kejar Mimpi Scholarship Awardee Batch 2025","Winner of 5+ business case competitions"],"expertise_slugs":["business-plan","business-case","marketing","proposal-development"],"linkedin_url":"https://www.linkedin.com/in/lubnaalkaysa/","portrait_asset_key":"mentors.lubna-qumilaila.portrait","photo_status":"ready","sort_order":150},
 {"id":"83000000-0000-0000-0000-000000000016","public_slug":"albert-lukas","display_name":"Albert Lukas","tier_name":"Young Professional","headline":null,"achievements":["Winner of 10+ business and marketing competitions"],"expertise_slugs":["marketing","business-plan","business-case"],"linkedin_url":null,"portrait_asset_key":"mentors.albert-lukas.portrait","photo_status":"missing","sort_order":160},
 {"id":"83000000-0000-0000-0000-000000000017","public_slug":"ruth-debora","display_name":"Ruth Debora","tier_name":"Top Student","headline":null,"achievements":["Winner of 10+ business competitions"],"expertise_slugs":["business-case","business-plan"],"linkedin_url":null,"portrait_asset_key":"mentors.ruth-debora.portrait","photo_status":"ready","sort_order":170},
 {"id":"83000000-0000-0000-0000-000000000018","public_slug":"muhammad-harits","display_name":"Muhammad Harits","tier_name":"Top Student","headline":null,"achievements":["Winner of 10+ business competitions"],"expertise_slugs":["marketing","business-plan","business-case"],"linkedin_url":null,"portrait_asset_key":"mentors.muhammad-harits.portrait","photo_status":"ready","sort_order":180},
 {"id":"83000000-0000-0000-0000-000000000019","public_slug":"rafi-aurelian","display_name":"Rafi Aurelian","tier_name":"Top Student","headline":null,"achievements":["Winner of 10+ business and research competitions"],"expertise_slugs":["business-case","business-plan"],"linkedin_url":"https://www.linkedin.com/in/rafiaurelian/","portrait_asset_key":"mentors.rafi-aurelian.portrait","photo_status":"ready","sort_order":190},
 {"id":"83000000-0000-0000-0000-000000000020","public_slug":"ratu-hanifa","display_name":"Ratu Hanifa","tier_name":"Top Student","headline":null,"achievements":["Winner of 10+ business and marketing competitions"],"expertise_slugs":["business-case","finance"],"linkedin_url":null,"portrait_asset_key":"mentors.ratu-hanifa.portrait","photo_status":"ready","sort_order":200},
 {"id":"83000000-0000-0000-0000-000000000021","public_slug":"william-philip","display_name":"William Philip","tier_name":"Top Student","headline":"Research Intern at Badan Pusat Statistik","achievements":["Most Potential Student FEB UI 2023","Highest GPA FEB UI 2023","1st Winner — Policy Brief Competition, 22nd Economix FEB UI × Tony Blair Institute"],"expertise_slugs":["business-plan","business-case"],"linkedin_url":"https://www.linkedin.com/in/williampk/","portrait_asset_key":"mentors.william-philip.portrait","photo_status":"ready","sort_order":210},
 {"id":"83000000-0000-0000-0000-000000000022","public_slug":"alvaro-zhafran","display_name":"Alvaro Zhafran","tier_name":"Top Student","headline":"Commercial Finance Intern at Siemens Mobility","achievements":["2nd Place — AlphaSights Asia Case Competition 2026","1st Winner — UI Makarapreneur Business Case Competition 2025","Winner of 5+ business case competitions"],"expertise_slugs":["business-case","finance"],"linkedin_url":"https://www.linkedin.com/in/alvaro-zhafran-prananta-a5986a220/","portrait_asset_key":"mentors.alvaro-zhafran.portrait","photo_status":"ready","sort_order":220},
 {"id":"83000000-0000-0000-0000-000000000023","public_slug":"adrian-nicholas","display_name":"Adrian Nicholas","tier_name":"Top Student","headline":"Product Development Intern at Allianz Indonesia","achievements":["1st Most Outstanding Student at FMIPA ITB","Project Leader — Gandeng Foundation × education technology startup","Winner of 5+ business case and consulting competitions"],"expertise_slugs":["business-case","business-plan"],"linkedin_url":null,"portrait_asset_key":"mentors.adrian-nicholas.portrait","photo_status":"ready","sort_order":230},
 {"id":"83000000-0000-0000-0000-000000000024","public_slug":"naura-tsabita-wibowo","display_name":"Naura Tsabita Wibowo","tier_name":"Top Student","headline":"Founder of Charmiez.id","achievements":["Global Winner — Lenovo Innovation Challenge","Asia Representative Finalist — De La Vega Global Entrepreneurship Award","Winner of 10+ business and marketing competitions"],"expertise_slugs":["business-plan","marketing","business-case"],"linkedin_url":"https://www.linkedin.com/in/naura-tsabita-wibowo-859428303/","portrait_asset_key":"mentors.naura-tsabita-wibowo.portrait","photo_status":"ready","sort_order":240},
 {"id":"83000000-0000-0000-0000-000000000025","public_slug":"faluna-a-janitra","display_name":"Faluna A. Janitra","tier_name":null,"headline":null,"achievements":["Winner of 10+ business and marketing competitions"],"expertise_slugs":["business-plan","marketing","business-case"],"linkedin_url":null,"portrait_asset_key":"mentors.faluna-a-janitra.portrait","photo_status":"missing","sort_order":250},
 {"id":"83000000-0000-0000-0000-000000000026","public_slug":"m-sultan-perkasa","display_name":"M. Sultan Perkasa","tier_name":null,"headline":null,"achievements":["Winner of 5+ business and accounting competitions"],"expertise_slugs":[],"linkedin_url":null,"portrait_asset_key":"mentors.m-sultan-perkasa.portrait","photo_status":"missing","sort_order":260}
]
$roster$::jsonb) as x(
  id text, public_slug text, display_name text, tier_name text, headline text,
  achievements jsonb, expertise_slugs jsonb, linkedin_url text,
  portrait_asset_key text, photo_status text, sort_order integer
);

-- Legacy public roster remains unlinked: mentor_user_id stays null. Ownership is
-- established later only through an explicit administrator action.
insert into public.mentor_public_profiles (
  id, mentor_user_id, public_slug, display_name, tier_id, headline, linkedin_url,
  portrait_asset_key, photo_status, publication_status, sort_order
)
select s.id, null::uuid, s.public_slug, s.display_name, t.id, s.headline,
  s.linkedin_url, s.portrait_asset_key, s.photo_status, 'published', s.sort_order
from mentor_public_roster_seed s
left join public.mentor_tiers t on t.name = s.tier_name
on conflict (public_slug) do nothing;

insert into public.mentor_public_achievements(mentor_public_profile_id, achievement, sort_order)
select s.id, a.value, a.ordinality::integer * 10
from mentor_public_roster_seed s
cross join lateral jsonb_array_elements_text(s.achievements) with ordinality a(value, ordinality)
on conflict (mentor_public_profile_id, achievement) do nothing;

insert into public.mentor_public_profile_expertise(mentor_public_profile_id, expertise_id)
select s.id, e.id
from mentor_public_roster_seed s
cross join lateral jsonb_array_elements_text(s.expertise_slugs) slug(value)
join public.mentor_expertise e on e.slug = slug.value
on conflict do nothing;

create function public.ensure_mentor_public_profile_for_user(p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_tier_id uuid;
  v_name text;
  v_slug_base text;
  v_slug text;
  v_sort integer;
begin
  select mp.tier_id,
    coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), nullif(btrim(p.username), ''), 'Mentor Strativate')
  into v_tier_id, v_name
  from public.mentor_profiles mp
  join public.profiles p on p.id = mp.user_id
  where mp.user_id = p_user_id and p.role = 'mentor'::public.app_role;
  if not found then raise exception 'Mentor account not found' using errcode = '22023'; end if;

  select id into v_existing from public.mentor_public_profiles where mentor_user_id = p_user_id;
  if found then return v_existing; end if;

  v_slug_base := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug_base = '' then v_slug_base := 'mentor'; end if;
  v_slug := left(v_slug_base, 100);
  if exists (select 1 from public.mentor_public_profiles where public_slug = v_slug) then
    v_slug := left(v_slug_base, 90) || '-' || left(replace(p_user_id::text, '-', ''), 8);
  end if;
  select coalesce(max(sort_order), 0) + 10 into v_sort from public.mentor_public_profiles;

  insert into public.mentor_public_profiles(
    mentor_user_id, public_slug, display_name, tier_id, publication_status, sort_order, photo_status
  ) values (p_user_id, v_slug, v_name, v_tier_id, 'draft', v_sort, 'missing')
  returning id into v_existing;
  return v_existing;
end;
$$;
revoke all on function public.ensure_mentor_public_profile_for_user(uuid) from public, anon, authenticated;

create function public.sync_linked_mentor_public_tier() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.mentor_public_profiles set tier_id = new.tier_id where mentor_user_id = new.user_id;
  return new;
end;
$$;
create trigger mentor_profiles_sync_public_tier
  after update of tier_id on public.mentor_profiles
  for each row execute function public.sync_linked_mentor_public_tier();

create function public.get_my_mentor_public_profile()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.mentor_public_profiles;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.mentor_profiles mp join public.profiles p on p.id = mp.user_id
    where mp.user_id = v_uid and p.role = 'mentor'::public.app_role
  ) then raise exception 'Mentor account required' using errcode = '42501'; end if;

  select * into v_profile from public.mentor_public_profiles where mentor_user_id = v_uid;
  return jsonb_build_object(
    'profile', case when v_profile.id is null then null else jsonb_build_object(
      'id', v_profile.id, 'public_slug', v_profile.public_slug,
      'display_name', v_profile.display_name, 'tier_id', v_profile.tier_id,
      'tier_name', (select t.name from public.mentor_tiers t where t.id = v_profile.tier_id),
      'headline', v_profile.headline, 'linkedin_url', v_profile.linkedin_url,
      'short_bio', v_profile.short_bio, 'portrait_asset_key', v_profile.portrait_asset_key,
      'portrait_url', v_profile.portrait_url, 'photo_status', v_profile.photo_status,
      'publication_status', v_profile.publication_status, 'sort_order', v_profile.sort_order
    ) end,
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'achievement', a.achievement, 'sort_order', a.sort_order) order by a.sort_order, a.id)
      from public.mentor_public_achievements a where a.mentor_public_profile_id = v_profile.id
    ), '[]'::jsonb),
    'expertise_ids', coalesce((
      select jsonb_agg(j.expertise_id order by e.sort_order, e.name)
      from public.mentor_public_profile_expertise j join public.mentor_expertise e on e.id = j.expertise_id
      where j.mentor_public_profile_id = v_profile.id
    ), '[]'::jsonb),
    'expertise_options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'slug', e.slug, 'sort_order', e.sort_order,
        'is_active', e.is_active,
        'assigned', exists (
          select 1 from public.mentor_public_profile_expertise j
          where j.mentor_public_profile_id = v_profile.id and j.expertise_id = e.id
        )
      ) order by e.sort_order, e.name)
      from public.mentor_expertise e
      where e.is_active or exists (
        select 1 from public.mentor_public_profile_expertise j
        where j.mentor_public_profile_id = v_profile.id and j.expertise_id = e.id
      )
    ), '[]'::jsonb)
  );
end;
$$;

create function public.save_my_mentor_public_profile(
  p_display_name text,
  p_headline text default null,
  p_linkedin_url text default null,
  p_short_bio text default null,
  p_portrait_url text default null,
  p_expertise_ids uuid[] default '{}'::uuid[],
  p_achievements text[] default '{}'::text[]
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_headline text := nullif(btrim(coalesce(p_headline, '')), '');
  v_linkedin text := nullif(btrim(coalesce(p_linkedin_url, '')), '');
  v_bio text := nullif(btrim(coalesce(p_short_bio, '')), '');
  v_portrait text := nullif(btrim(coalesce(p_portrait_url, '')), '');
  v_expertise_ids uuid[] := coalesce(p_expertise_ids, '{}'::uuid[]);
  v_achievements text[] := coalesce(p_achievements, '{}'::text[]);
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.mentor_profiles mp join public.profiles p on p.id = mp.user_id
    where mp.user_id = v_uid and mp.is_active and p.role = 'mentor'::public.app_role
  ) then raise exception 'Active mentor account required' using errcode = '42501'; end if;
  if char_length(v_display_name) not between 1 and 120 then raise exception 'Public display name is required' using errcode = '22023'; end if;
  if v_headline is not null and char_length(v_headline) > 180 then raise exception 'Headline is too long' using errcode = '22023'; end if;
  if v_bio is not null and char_length(v_bio) > 1200 then raise exception 'Public bio is too long' using errcode = '22023'; end if;
  if v_linkedin is not null and (char_length(v_linkedin) > 2048 or v_linkedin !~ '^https?://') then raise exception 'Invalid LinkedIn URL' using errcode = '22023'; end if;
  if v_portrait is not null and (char_length(v_portrait) > 2048 or v_portrait !~ '^https?://') then raise exception 'Invalid portrait URL' using errcode = '22023'; end if;
  if cardinality(v_expertise_ids) > 30 or cardinality(v_achievements) > 30 then raise exception 'Too many public profile items' using errcode = '22023'; end if;
  if cardinality(v_expertise_ids) <> (select count(distinct value) from unnest(v_expertise_ids) value) then raise exception 'Duplicate expertise selection' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_achievements) value where char_length(btrim(value)) not between 1 and 500) then raise exception 'Invalid achievement' using errcode = '22023'; end if;

  v_profile_id := public.ensure_mentor_public_profile_for_user(v_uid);
  if exists (
    select 1 from unnest(v_expertise_ids) selected_id
    left join public.mentor_expertise e on e.id = selected_id
    where e.id is null or (not e.is_active and not exists (
      select 1 from public.mentor_public_profile_expertise existing
      where existing.mentor_public_profile_id = v_profile_id and existing.expertise_id = selected_id
    ))
  ) then raise exception 'Only active or already assigned inactive expertise may be selected' using errcode = '22023'; end if;

  update public.mentor_public_profiles
  set display_name = v_display_name, headline = v_headline, linkedin_url = v_linkedin,
      short_bio = v_bio, portrait_url = v_portrait,
      photo_status = case when v_portrait is not null or portrait_asset_key is not null then 'ready' else 'missing' end
  where id = v_profile_id;

  delete from public.mentor_public_profile_expertise
  where mentor_public_profile_id = v_profile_id and expertise_id <> all(v_expertise_ids);
  insert into public.mentor_public_profile_expertise(mentor_public_profile_id, expertise_id)
  select v_profile_id, selected_id from unnest(v_expertise_ids) selected_id on conflict do nothing;

  delete from public.mentor_public_achievements where mentor_public_profile_id = v_profile_id;
  insert into public.mentor_public_achievements(mentor_public_profile_id, achievement, sort_order)
  select v_profile_id, btrim(value), ordinality::integer * 10
  from unnest(v_achievements) with ordinality item(value, ordinality);

  return public.get_my_mentor_public_profile();
end;
$$;

create function public.admin_upsert_mentor_expertise(
  p_name text,
  p_id uuid default null,
  p_is_active boolean default true,
  p_sort_order integer default null
)
returns public.mentor_expertise
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
  v_sort integer;
  v_row public.mentor_expertise;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 100 then raise exception 'Expertise name is required' using errcode = '22023'; end if;
  if p_is_active is null then raise exception 'Expertise status is required' using errcode = '22023'; end if;
  if exists (select 1 from public.mentor_expertise where lower(name) = lower(v_name) and (p_id is null or id <> p_id)) then raise exception 'Expertise name already exists' using errcode = '23505'; end if;

  if p_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then raise exception 'Expertise name cannot form a stable slug' using errcode = '22023'; end if;
    if exists (select 1 from public.mentor_expertise where slug = v_slug) then raise exception 'Expertise slug already exists' using errcode = '23505'; end if;
    select coalesce(max(sort_order), 0) + 10 into v_sort from public.mentor_expertise;
    if p_sort_order is not null then v_sort := p_sort_order; end if;
    insert into public.mentor_expertise(name, slug, sort_order, is_active)
    values (v_name, v_slug, greatest(v_sort, 0), p_is_active) returning * into v_row;
  else
    update public.mentor_expertise
    set name = v_name, is_active = p_is_active, sort_order = coalesce(p_sort_order, sort_order)
    where id = p_id returning * into v_row;
    if not found then raise exception 'Expertise not found' using errcode = '22023'; end if;
  end if;
  return v_row;
end;
$$;

create function public.admin_reorder_mentor_expertise(p_ids uuid[])
returns setof public.mentor_expertise
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_ids is null or cardinality(p_ids) <> (select count(*) from public.mentor_expertise) then raise exception 'Reorder list must include every expertise exactly once' using errcode = '22023'; end if;
  if cardinality(p_ids) <> (select count(distinct value) from unnest(p_ids) value) then raise exception 'Duplicate expertise in reorder list' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_ids) value left join public.mentor_expertise e on e.id = value where e.id is null) then raise exception 'Unknown expertise in reorder list' using errcode = '22023'; end if;
  update public.mentor_expertise e set sort_order = ordered.ordinality::integer * 10
  from unnest(p_ids) with ordinality ordered(id, ordinality) where e.id = ordered.id;
  return query select * from public.mentor_expertise order by sort_order, name;
end;
$$;

create function public.admin_delete_mentor_expertise(p_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if exists (select 1 from public.mentor_public_profile_expertise where expertise_id = p_id) then return 'deactivate_required'; end if;
  delete from public.mentor_expertise where id = p_id;
  if not found then raise exception 'Expertise not found' using errcode = '22023'; end if;
  return 'deleted';
end;
$$;

create function public.admin_ensure_mentor_public_profile(p_mentor_id uuid)
returns public.mentor_public_profiles
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_row public.mentor_public_profiles;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  v_id := public.ensure_mentor_public_profile_for_user(p_mentor_id);
  select * into v_row from public.mentor_public_profiles where id = v_id;
  return v_row;
end;
$$;

create function public.admin_link_mentor_public_profile(p_public_profile_id uuid, p_mentor_id uuid)
returns public.mentor_public_profiles
language plpgsql security definer set search_path = '' as $$
declare v_tier_id uuid; v_row public.mentor_public_profiles;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select tier_id into v_tier_id from public.mentor_profiles where user_id = p_mentor_id;
  if not found then raise exception 'Mentor account not found' using errcode = '22023'; end if;
  if exists (select 1 from public.mentor_public_profiles where mentor_user_id = p_mentor_id and id <> p_public_profile_id) then raise exception 'Mentor already owns another public profile' using errcode = '23505'; end if;
  update public.mentor_public_profiles
  set mentor_user_id = p_mentor_id, tier_id = v_tier_id
  where id = p_public_profile_id and (mentor_user_id is null or mentor_user_id = p_mentor_id)
  returning * into v_row;
  if not found then raise exception 'Public mentor profile is already owned by another mentor' using errcode = '23505'; end if;
  return v_row;
end;
$$;

create function public.admin_set_mentor_publication(p_mentor_id uuid, p_status text)
returns public.mentor_public_profiles
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_row public.mentor_public_profiles;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_status not in ('draft', 'published') then raise exception 'Invalid publication status' using errcode = '22023'; end if;
  v_id := public.ensure_mentor_public_profile_for_user(p_mentor_id);
  update public.mentor_public_profiles set publication_status = p_status where id = v_id returning * into v_row;
  return v_row;
end;
$$;

create function public.list_public_mentors()
returns table(
  public_slug text,
  display_name text,
  tier_name text,
  headline text,
  linkedin_url text,
  short_bio text,
  portrait_asset_key text,
  portrait_url text,
  photo_status text,
  achievements text[],
  expertise text[]
)
language sql stable security definer set search_path = '' as $$
  select p.public_slug, p.display_name, t.name, p.headline, p.linkedin_url,
    p.short_bio, p.portrait_asset_key, p.portrait_url, p.photo_status,
    coalesce((select array_agg(a.achievement order by a.sort_order, a.id)
      from public.mentor_public_achievements a where a.mentor_public_profile_id = p.id), '{}'::text[]),
    coalesce((select array_agg(e.name order by e.sort_order, e.name)
      from public.mentor_public_profile_expertise j
      join public.mentor_expertise e on e.id = j.expertise_id
      where j.mentor_public_profile_id = p.id), '{}'::text[])
  from public.mentor_public_profiles p
  left join public.mentor_tiers t on t.id = p.tier_id
  where p.publication_status = 'published'
  order by p.sort_order, p.public_slug;
$$;

alter table public.mentor_public_profiles enable row level security;
alter table public.mentor_public_achievements enable row level security;
alter table public.mentor_expertise enable row level security;
alter table public.mentor_public_profile_expertise enable row level security;

create policy mentor_public_profiles_authenticated_read on public.mentor_public_profiles
for select to authenticated using (public.is_admin() or mentor_user_id = auth.uid());
create policy mentor_public_achievements_authenticated_read on public.mentor_public_achievements
for select to authenticated using (public.is_admin() or exists (
  select 1 from public.mentor_public_profiles p where p.id = mentor_public_profile_id and p.mentor_user_id = auth.uid()
));
create policy mentor_expertise_authenticated_read on public.mentor_expertise
for select to authenticated using (public.is_admin() or is_active or exists (
  select 1 from public.mentor_public_profile_expertise j
  join public.mentor_public_profiles p on p.id = j.mentor_public_profile_id
  where j.expertise_id = mentor_expertise.id and p.mentor_user_id = auth.uid()
));
create policy mentor_public_profile_expertise_authenticated_read on public.mentor_public_profile_expertise
for select to authenticated using (public.is_admin() or exists (
  select 1 from public.mentor_public_profiles p where p.id = mentor_public_profile_id and p.mentor_user_id = auth.uid()
));

revoke all on public.mentor_public_profiles, public.mentor_public_achievements,
  public.mentor_expertise, public.mentor_public_profile_expertise from anon, authenticated;
grant select on public.mentor_public_profiles, public.mentor_public_achievements,
  public.mentor_expertise, public.mentor_public_profile_expertise to authenticated;
grant all on public.mentor_public_profiles, public.mentor_public_achievements,
  public.mentor_expertise, public.mentor_public_profile_expertise to service_role;

revoke all on function public.get_my_mentor_public_profile(),
  public.save_my_mentor_public_profile(text, text, text, text, text, uuid[], text[]),
  public.admin_upsert_mentor_expertise(text, uuid, boolean, integer),
  public.admin_reorder_mentor_expertise(uuid[]), public.admin_delete_mentor_expertise(uuid),
  public.admin_ensure_mentor_public_profile(uuid), public.admin_link_mentor_public_profile(uuid, uuid),
  public.admin_set_mentor_publication(uuid, text), public.list_public_mentors()
from public, anon, authenticated;

grant execute on function public.get_my_mentor_public_profile(),
  public.save_my_mentor_public_profile(text, text, text, text, text, uuid[], text[]),
  public.admin_upsert_mentor_expertise(text, uuid, boolean, integer),
  public.admin_reorder_mentor_expertise(uuid[]), public.admin_delete_mentor_expertise(uuid),
  public.admin_ensure_mentor_public_profile(uuid), public.admin_link_mentor_public_profile(uuid, uuid),
  public.admin_set_mentor_publication(uuid, text)
to authenticated;
grant execute on function public.list_public_mentors() to anon, authenticated;

grant execute on function public.get_my_mentor_public_profile(),
  public.save_my_mentor_public_profile(text, text, text, text, text, uuid[], text[]),
  public.admin_upsert_mentor_expertise(text, uuid, boolean, integer),
  public.admin_reorder_mentor_expertise(uuid[]), public.admin_delete_mentor_expertise(uuid),
  public.admin_ensure_mentor_public_profile(uuid), public.admin_link_mentor_public_profile(uuid, uuid),
  public.admin_set_mentor_publication(uuid, text), public.list_public_mentors()
to service_role;

comment on table public.mentor_public_profiles is
  'Public mentor directory domain. Ownership is optional and must never be inferred from legacy roster identity.';
comment on column public.mentor_public_profiles.mentor_user_id is
  'Explicit optional link to an authenticated operational mentor account; legacy imported rows remain null until intentionally linked.';
comment on column public.mentor_public_profiles.portrait_asset_key is
  'Existing approved bundled mentor asset-registry key retained during staged portrait migration.';
comment on column public.mentor_public_profiles.portrait_url is
  'Optional explicit public portrait URL; this migration does not add an upload subsystem.';
