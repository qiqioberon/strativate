begin;

do $test$
declare v_default text;v_constraint text;
begin
 if to_regclass('public.intensive_mentoring_engagements') is null then raise exception 'intensive engagements table missing';end if;
 if to_regclass('public.intensive_mentoring_sessions') is null then raise exception 'intensive sessions table missing';end if;
 if to_regclass('public.intensive_mentoring_session_calendar_integrations') is null then raise exception 'intensive calendar integration table missing';end if;
 if to_regprocedure('public.admin_add_intensive_mentoring_session(uuid,integer,text)') is null then raise exception 'admin add session RPC missing';end if;
 if to_regprocedure('public.list_my_mentor_intensive_mentoring_sessions()') is null then raise exception 'mentor projection missing';end if;
 if to_regprocedure('public.list_admin_intensive_mentoring_calendar_sessions(timestamptz,timestamptz)') is null then raise exception 'admin calendar projection missing';end if;

 select column_default into v_default from information_schema.columns where table_schema='public' and table_name='intensive_mentoring_sessions' and column_name='topic_status';
 if v_default is null or v_default not like '%needs_input%' then raise exception 'topic_status default must be needs_input, got %',v_default;end if;

 if not exists(select 1 from public.intensive_mentoring_packages where code='INTENSIVE' and sessions_per_month=4 and price_amount=1150000 and reference_price_amount=1400000 and is_active) then raise exception 'INTENSIVE source values drifted';end if;
 if not exists(select 1 from public.intensive_mentoring_packages where code='SUPER_INTENSIVE' and sessions_per_month=8 and price_amount=2200000 and reference_price_amount=2800000 and is_active) then raise exception 'SUPER_INTENSIVE source values drifted';end if;
 if not exists(select 1 from public.intensive_mentoring_packages where code='INTERNATIONAL_COMPETITION' and pricing_mode='consultation' and price_amount is null and reference_price_amount is null and is_active) then raise exception 'international consultation package drifted';end if;
 if exists(select 1 from public.intensive_mentoring_add_ons where code='WIN_GUARANTEE_PROTECTION' and is_active) then raise exception 'Win Guarantee must stay inactive';end if;
 if exists(select 1 from public.intensive_mentoring_bundles where code='COMPETITION_ASSURANCE' and is_active) then raise exception 'Competition Assurance must stay inactive';end if;

 select pg_get_constraintdef(oid) into v_constraint
 from pg_constraint
 where conrelid='public.intensive_mentoring_session_calendar_integrations'::regclass
   and contype='c' and pg_get_constraintdef(oid) ilike '%meeting_provider%';
 if v_constraint is null or v_constraint ilike '%google_meet%' then raise exception 'Intensive meeting provider constraint must remain Zoom-only: %',v_constraint;end if;
end
$test$;

rollback;
