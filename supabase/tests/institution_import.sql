-- Isolated database test, after both migrations. Fixtures always roll back.
begin;
create schema test_import;
create function test_import.assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; end;
$$;
select test_import.assert(not has_function_privilege('anon', 'public.import_institutions_batch(jsonb)', 'execute'), 'anonymous importer forbidden');
select test_import.assert(not has_function_privilege('authenticated', 'public.import_institutions_batch(jsonb)', 'execute'), 'browser importer forbidden');
select test_import.assert(has_function_privilege('service_role', 'public.import_institutions_batch(jsonb)', 'execute'), 'server importer permitted');
select test_import.assert(public.import_institutions_batch('[{"name":"Test University","type":"university","source":"bima_kemdiktisaintek","external_id":"import-test-1","approval_status":"approved"},{"name":"Test University","type":"university","source":"bima_kemdiktisaintek","external_id":"import-test-2","approval_status":"approved"}]') = '{"inserted":2,"updated":0,"skipped":0}'::jsonb, 'same display name distinct official identity');
select test_import.assert(public.import_institutions_batch('[{"name":"Test University","type":"university","source":"bima_kemdiktisaintek","external_id":"import-test-1","approval_status":"approved"},{"name":"Test University","type":"university","source":"bima_kemdiktisaintek","external_id":"import-test-2","approval_status":"approved"}]') = '{"inserted":0,"updated":0,"skipped":2}'::jsonb, 'repeat import skips');
select test_import.assert(public.import_institutions_batch('[{"name":"Test University","city":"Bandung","type":"university","source":"bima_kemdiktisaintek","external_id":"import-test-1","approval_status":"approved"}]') = '{"inserted":0,"updated":1,"skipped":0}'::jsonb, 'changed metadata updates');
do $$
begin
  begin
    perform public.import_institutions_batch('[{"name":"Valid First","type":"sma","source":"school_pdf","external_id":"import-test-atomic","approval_status":"approved"},{"name":"Invalid Second","type":"sma","source":"user_submission","external_id":"import-test-invalid","approval_status":"approved"}]');
    raise exception 'Invalid source accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
select test_import.assert(not exists(select 1 from public.institutions where external_id = 'import-test-atomic'), 'batch rollback on invalid later row');
insert into auth.users (id,email) values ('90000000-0000-0000-0000-000000000001','import-test@test.invalid');
insert into public.institutions (name,type,source,external_id,submitted_by,approval_status) values ('User School','sma','school_pdf','import-test-submission','90000000-0000-0000-0000-000000000001','pending');
do $$
begin
  begin
    perform public.import_institutions_batch('[{"name":"Must Not Overwrite","type":"sma","source":"school_pdf","external_id":"import-test-submission","approval_status":"approved"}]');
    raise exception 'Submission overwritten';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select test_import.assert((select name = 'User School' and approval_status = 'pending' from public.institutions where external_id='import-test-submission'), 'import preserves user submission');
rollback;
