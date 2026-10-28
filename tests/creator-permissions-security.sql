-- Run with psql -v ON_ERROR_STOP=1; all fixtures and review writes roll back.
BEGIN;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); staff uuid;
BEGIN
  SELECT user_id INTO staff FROM public.user_roles WHERE role::text = 'admin' LIMIT 1;
  IF staff IS NULL THEN RAISE EXCEPTION 'Staff fixture required'; END IF;
  PERFORM set_config('test.creator_a',a::text,true);
  PERFORM set_config('test.creator_b',b::text,true);
  PERFORM set_config('test.creator_staff',staff::text,true);
  INSERT INTO public.supporter_applications(user_id,channel_links,plan,status)
    VALUES(a,'https://youtube.com/@security-test-a','','approved'),
          (b,'https://youtube.com/@security-test-b','','approved');
  INSERT INTO public.creator_videos(user_id,url,title)
    VALUES(a,'https://youtu.be/'||a,'fixture'),(b,'https://youtu.be/'||b,'fixture');
  INSERT INTO public.creator_license_claims(user_id) VALUES(a),(b);
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',json_build_object('sub',current_setting('test.creator_a'),'role','authenticated','aal','aal2')::text,true) IS NOT NULL;
DO $$
DECLARE t text; blocked boolean; other_video uuid; other_app uuid;
BEGIN
  FOREACH t IN ARRAY ARRAY['creator_videos','creator_license_claims','supporter_applications'] LOOP
    IF has_table_privilege('anon','public.'||t,'SELECT') THEN RAISE EXCEPTION 'Anonymous read: %',t; END IF;
    IF has_table_privilege('authenticated','public.'||t,'INSERT') OR
       has_table_privilege('authenticated','public.'||t,'UPDATE') OR
       has_table_privilege('authenticated','public.'||t,'DELETE') OR
       has_any_column_privilege('authenticated','public.'||t,'UPDATE') THEN
      RAISE EXCEPTION 'Direct writes: %',t;
    END IF;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE user_id=$1)',t)
      INTO blocked USING current_setting('test.creator_b')::uuid;
    IF blocked THEN RAISE EXCEPTION 'Cross-user read: %',t; END IF;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE user_id=$1)',t)
      INTO blocked USING current_setting('test.creator_a')::uuid;
    IF NOT blocked THEN RAISE EXCEPTION 'Owner read broken: %',t; END IF;
  END LOOP;
  IF NOT public.is_approved_creator(auth.uid()) THEN RAISE EXCEPTION 'Own eligibility changed'; END IF;
  IF public.is_approved_creator(current_setting('test.creator_b')::uuid) THEN RAISE EXCEPTION 'Cross-user status disclosure'; END IF;
  blocked := false;
  BEGIN
    PERFORM public.review_supporter_application(gen_random_uuid(),'approved','');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'not_allowed' THEN RAISE; END IF;
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Creator allowed to review'; END IF;
  blocked := false;
  BEGIN
    PERFORM public.review_creator_item('video',gen_random_uuid(),'approved','');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'not_allowed' THEN RAISE; END IF;
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Creator allowed to review content'; END IF;
END $$;
RESET ROLE;
SELECT set_config('test.other_video',(SELECT id::text FROM public.creator_videos WHERE user_id=current_setting('test.creator_b')::uuid),true) IS NOT NULL;
SELECT set_config('test.other_app',(SELECT id::text FROM public.supporter_applications WHERE user_id=current_setting('test.creator_b')::uuid),true) IS NOT NULL;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.delete_my_creator_video(current_setting('test.other_video')::uuid) THEN
    RAISE EXCEPTION 'Creator deleted another user video';
  END IF;
END $$;
SELECT set_config('request.jwt.claims',json_build_object('sub',current_setting('test.creator_staff'),'role','authenticated','aal','aal2')::text,true) IS NOT NULL;
DO $$ BEGIN
  IF NOT public.is_approved_creator(current_setting('test.creator_b')::uuid) THEN
    RAISE EXCEPTION 'Authorized staff lookup broken';
  END IF;
  PERFORM public.review_supporter_application(current_setting('test.other_app')::uuid,'approved','security fixture');
  IF NOT EXISTS (SELECT 1 FROM public.supporter_applications
    WHERE id=current_setting('test.other_app')::uuid
      AND reviewed_by=auth.uid() AND reviewed_at=now()) THEN
    RAISE EXCEPTION 'Reviewer attribution incorrect';
  END IF;
END $$;
ROLLBACK;