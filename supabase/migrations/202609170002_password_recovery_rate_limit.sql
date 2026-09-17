-- Durable application-level throttling for password recovery.
-- Identifiers are HMAC-SHA256 hashes produced by the server; raw email/IP values are never stored here.

create table if not exists public.password_recovery_rate_limits (
  scope text not null check (scope in ('email', 'ip')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default clock_timestamp(),
  request_count integer not null default 0 check (request_count >= 0),
  last_request_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (scope, key_hash)
);

alter table public.password_recovery_rate_limits enable row level security;
revoke all on public.password_recovery_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.password_recovery_rate_limits to service_role;

create or replace function public.consume_password_recovery_rate_limit(
  p_email_hash text,
  p_ip_hash text default null
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_email_window timestamptz;
  v_email_count integer;
  v_email_last timestamptz;
  v_ip_window timestamptz;
  v_ip_count integer;
  v_retry integer;
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid email rate-limit key' using errcode = '22023';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid ip rate-limit key' using errcode = '22023';
  end if;

  delete from public.password_recovery_rate_limits
  where updated_at < v_now - interval '24 hours';

  insert into public.password_recovery_rate_limits (scope, key_hash)
  values ('email', p_email_hash)
  on conflict do nothing;

  select window_started_at, request_count, last_request_at
    into v_email_window, v_email_count, v_email_last
  from public.password_recovery_rate_limits
  where scope = 'email' and key_hash = p_email_hash
  for update;

  if v_email_window <= v_now - interval '1 hour' then
    v_email_window := v_now;
    v_email_count := 0;
  end if;

  if v_email_last is not null and v_email_last > v_now - interval '60 seconds' then
    v_retry := greatest(1, ceil(extract(epoch from (v_email_last + interval '60 seconds' - v_now)))::integer);
    return query select false, v_retry;
    return;
  end if;

  if v_email_count >= 5 then
    v_retry := greatest(1, ceil(extract(epoch from (v_email_window + interval '1 hour' - v_now)))::integer);
    return query select false, v_retry;
    return;
  end if;

  if p_ip_hash is not null then
    insert into public.password_recovery_rate_limits (scope, key_hash)
    values ('ip', p_ip_hash)
    on conflict do nothing;

    select window_started_at, request_count
      into v_ip_window, v_ip_count
    from public.password_recovery_rate_limits
    where scope = 'ip' and key_hash = p_ip_hash
    for update;

    if v_ip_window <= v_now - interval '1 hour' then
      v_ip_window := v_now;
      v_ip_count := 0;
    end if;

    if v_ip_count >= 30 then
      v_retry := greatest(1, ceil(extract(epoch from (v_ip_window + interval '1 hour' - v_now)))::integer);
      return query select false, v_retry;
      return;
    end if;
  end if;

  update public.password_recovery_rate_limits
  set window_started_at = v_email_window,
      request_count = v_email_count + 1,
      last_request_at = v_now,
      updated_at = v_now
  where scope = 'email' and key_hash = p_email_hash;

  if p_ip_hash is not null then
    update public.password_recovery_rate_limits
    set window_started_at = v_ip_window,
        request_count = v_ip_count + 1,
        last_request_at = v_now,
        updated_at = v_now
    where scope = 'ip' and key_hash = p_ip_hash;
  end if;

  return query select true, 60;
end;
$$;

revoke all on function public.consume_password_recovery_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_password_recovery_rate_limit(text, text) to service_role;
