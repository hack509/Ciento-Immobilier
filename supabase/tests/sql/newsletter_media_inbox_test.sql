-- =====================================================
-- Migration 019 tests: newsletter, contact inbox, listing media, avatars.
-- Runs after marketplace_security_test.sql (reuses its users and listings).
-- =====================================================
\set ON_ERROR_STOP 1
\set QUIET 1

RESET ROLE;
CREATE TEMP TABLE ctx2 (k TEXT PRIMARY KEY, v TEXT);
GRANT ALL ON ctx2 TO PUBLIC;
INSERT INTO ctx2 VALUES
  ('p1', (SELECT id::TEXT FROM public.properties WHERE title LIKE 'Maison test un%' LIMIT 1)),
  ('agency', (SELECT id::TEXT FROM public.agencies LIMIT 1));
UPDATE public.site_settings SET value = '2' WHERE key = 'contact_rate_limit_per_hour';

-- ---------- Newsletter: subscription & consent ----------
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
DO $$
DECLARE
  v_token TEXT;
  v_purpose TEXT;
BEGIN
  SELECT out_token, out_purpose INTO v_token, v_purpose FROM public.request_newsletter_subscription('Lecteur@Test.ht', '41.0.0.1');
  PERFORM public.record_newsletter_request('lecteur@test.ht', '41.0.0.1', 'Mozilla/5.0', 'footer');
  IF v_purpose <> 'confirm' THEN RAISE EXCEPTION 'FAIL new subscriber did not get a confirmation token'; END IF;
  IF (SELECT status FROM public.newsletter_subscribers WHERE email = 'lecteur@test.ht') <> 'pending' THEN
    RAISE EXCEPTION 'FAIL new subscriber not pending';
  END IF;
  INSERT INTO ctx2 VALUES ('confirm_token', v_token);

  PERFORM public.request_newsletter_subscription('lecteur@test.ht', '41.0.0.1');
  IF (SELECT count(*) FROM public.newsletter_subscribers WHERE lower(email) = 'lecteur@test.ht') <> 1 THEN
    RAISE EXCEPTION 'FAIL duplicate subscription created a second row';
  END IF;
  -- The second request replaced the token: fetch a fresh one for the confirmation test.
  SELECT out_token INTO v_token FROM public.request_newsletter_subscription('lecteur@test.ht', '41.0.0.2');
  UPDATE ctx2 SET v = v_token WHERE k = 'confirm_token';
  RAISE NOTICE 'PASS duplicate subscriptions are prevented';

  BEGIN
    PERFORM public.request_newsletter_subscription('pas-un-email', '41.0.0.1');
    RAISE EXCEPTION 'FAIL invalid e-mail accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE NOTICE 'PASS invalid e-mail rejected';
  END;

  IF EXISTS (SELECT 1 FROM public.newsletter_consent_events WHERE ip_hash = '41.0.0.1')
     OR NOT EXISTS (SELECT 1 FROM public.newsletter_consent_events WHERE event = 'subscription_requested' AND ip_hash IS NOT NULL AND source = 'footer') THEN
    RAISE EXCEPTION 'FAIL consent proof missing or raw IP stored';
  END IF;
  RAISE NOTICE 'PASS consent recorded with hashed IP';

  -- A second, already active subscriber for campaigns.
  PERFORM public.request_newsletter_subscription('fidele@test.ht', '41.0.0.3');
  UPDATE public.newsletter_subscribers SET is_active = TRUE WHERE email = 'fidele@test.ht';
END $$;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  IF NOT public.confirm_newsletter_subscription((SELECT v FROM ctx2 WHERE k = 'confirm_token')) THEN
    RAISE EXCEPTION 'FAIL confirmation link rejected';
  END IF;
  IF EXISTS (SELECT 1 FROM public.newsletter_subscribers) THEN
    RAISE EXCEPTION 'FAIL anon can read newsletter subscribers';
  END IF;
  RAISE NOTICE 'PASS double opt-in confirmation, subscribers private';
END $$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT status FROM public.newsletter_subscribers WHERE email = 'lecteur@test.ht') <> 'active'
     OR (SELECT confirmed_at FROM public.newsletter_subscribers WHERE email = 'lecteur@test.ht') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.newsletter_consent_events e JOIN public.newsletter_subscribers s ON s.id = e.subscriber_id
                    WHERE s.email = 'lecteur@test.ht' AND e.event = 'confirmed') THEN
    RAISE EXCEPTION 'FAIL status/consent not updated by confirmation';
  END IF;
  RAISE NOTICE 'PASS legacy is_active flag and status stay in sync';
END $$;

-- ---------- Newsletter: administration & campaigns ----------
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.newsletter_campaigns (subject, content) VALUES ('Spam', 'Contenu non autorisé ici');
    RAISE EXCEPTION 'FAIL non-admin created a campaign';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS only admins manage campaigns';
  END;
  BEGIN
    PERFORM public.admin_newsletter_stats();
    RAISE EXCEPTION 'FAIL non-admin read newsletter stats';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', FALSE);
DO $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.newsletter_campaigns (subject, content, status, sent_count)
  VALUES ('Nouveautés de novembre', 'Découvrez les nouvelles annonces aux Gonaïves.', 'sent', 999)
  RETURNING id INTO v_id;
  IF (SELECT status FROM public.newsletter_campaigns WHERE id = v_id) <> 'draft'
     OR (SELECT sent_count FROM public.newsletter_campaigns WHERE id = v_id) <> 0 THEN
    RAISE EXCEPTION 'FAIL campaign status/counters writable by client';
  END IF;
  INSERT INTO ctx2 VALUES ('campaign', v_id::TEXT);

  IF public.admin_start_newsletter_campaign(v_id, 'resend') <> 2 THEN
    RAISE EXCEPTION 'FAIL audience snapshot should contain the 2 active subscribers';
  END IF;
  BEGIN
    PERFORM public.admin_start_newsletter_campaign(v_id, 'resend');
    RAISE EXCEPTION 'FAIL campaign started twice';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.newsletter_campaigns SET content = 'Contenu modifié après envoi !!' WHERE id = v_id;
    RAISE EXCEPTION 'FAIL content edited after sending started';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS campaign frozen once started, no double send';

  -- Suspension by an administrator survives a new confirmation request.
  UPDATE public.newsletter_subscribers SET status = 'suspended', suspended_reason = 'test' WHERE email = 'fidele@test.ht';
END $$;

RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
DO $$
DECLARE
  v_batch RECORD;
  v_n INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
  v_summary JSONB;
BEGIN
  FOR v_batch IN SELECT * FROM public.claim_newsletter_batch((SELECT v::UUID FROM ctx2 WHERE k = 'campaign'), 100) LOOP
    v_n := v_n + 1;
    INSERT INTO ctx2 VALUES ('unsub_token', v_batch.unsubscribe_token) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
    v_results := v_results || jsonb_build_object('log_id', v_batch.log_id, 'ok', TRUE, 'message_id', 'msg-' || v_batch.log_id);
  END LOOP;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL suspended subscriber was not skipped (claimed %)', v_n; END IF;
  v_summary := public.record_newsletter_batch((SELECT v::UUID FROM ctx2 WHERE k = 'campaign'), v_results);
  IF (SELECT status FROM public.newsletter_campaigns WHERE id = (SELECT v::UUID FROM ctx2 WHERE k = 'campaign')) <> 'partially_sent' THEN
    RAISE EXCEPTION 'FAIL campaign final status wrong: %', v_summary;
  END IF;
  RAISE NOTICE 'PASS batch sending, suspended recipients skipped, honest final status';

  PERFORM public.record_email_event('msg-' || (SELECT min(id) FROM public.newsletter_campaign_logs WHERE status = 'sent'), 'delivered');
  PERFORM public.record_email_event((SELECT provider_message_id FROM public.newsletter_campaign_logs WHERE provider_message_id IS NOT NULL LIMIT 1), 'delivered');
  IF (SELECT delivered_count FROM public.newsletter_campaigns WHERE id = (SELECT v::UUID FROM ctx2 WHERE k = 'campaign')) <> 1 THEN
    RAISE EXCEPTION 'FAIL delivery events counted twice';
  END IF;
  RAISE NOTICE 'PASS provider events are idempotent';

  IF public.confirm_newsletter_subscription('0000000000000000000000000000000000000000000000000000000000000000') THEN
    RAISE EXCEPTION 'FAIL fake token accepted';
  END IF;
END $$;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  IF NOT public.unsubscribe_newsletter((SELECT v FROM ctx2 WHERE k = 'unsub_token')) THEN
    RAISE EXCEPTION 'FAIL one-click unsubscribe link rejected';
  END IF;
  IF public.unsubscribe_newsletter((SELECT v FROM ctx2 WHERE k = 'unsub_token')) THEN
    RAISE EXCEPTION 'FAIL unsubscribe token reusable';
  END IF;
  RAISE NOTICE 'PASS unsubscribe link from a campaign works once';
END $$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT status FROM public.newsletter_subscribers WHERE email = 'lecteur@test.ht') <> 'unsubscribed' THEN
    RAISE EXCEPTION 'FAIL unsubscription not reflected in status';
  END IF;
  IF (SELECT status FROM public.newsletter_subscribers WHERE email = 'fidele@test.ht') <> 'suspended' THEN
    RAISE EXCEPTION 'FAIL suspension lost';
  END IF;
  RAISE NOTICE 'PASS unsubscription immediately effective';
END $$;

-- ---------- Contact inbox ----------
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
SELECT set_config('request.headers', '{"x-forwarded-for": "102.0.0.9, 10.0.0.1", "user-agent": "TestAgent"}', FALSE);
DO $$
DECLARE
  v_id UUID;
BEGIN
  v_id := public.submit_contact_message('Paul Visiteur', 'paul@visiteur.ht', '+50937000000', 'Question sur vos services',
                                        'Bonjour, je voudrais des informations sur la gestion locative.');
  INSERT INTO ctx2 VALUES ('msg', v_id::TEXT);
  BEGIN
    PERFORM public.submit_contact_message('Paul Visiteur', 'paul@visiteur.ht', NULL, 'Question sur vos services',
                                          'Bonjour, je voudrais des informations sur la gestion locative.');
    RAISE EXCEPTION 'FAIL duplicate contact message accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  PERFORM public.submit_contact_message('Paul Visiteur', 'paul@visiteur.ht', NULL, 'Deuxième question', 'Un autre message, différent du premier.');
  BEGIN
    PERFORM public.submit_contact_message('Paul Visiteur', 'paul@visiteur.ht', NULL, 'Troisième', 'Encore un message différent des autres.');
    RAISE EXCEPTION 'FAIL contact rate limit not enforced';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS contact form stored, duplicates and floods rejected';

  PERFORM public.submit_contact_message('Rose Client', 'rose@client.ht', NULL, 'Rendez-vous agence',
                                        'Je souhaite rencontrer un agent de votre agence.', 'agency', NULL, (SELECT v::UUID FROM ctx2 WHERE k = 'agency'));
  IF EXISTS (SELECT 1 FROM public.contact_messages) THEN
    RAISE EXCEPTION 'FAIL visitors can read contact messages';
  END IF;
  RAISE NOTICE 'PASS messages are private to the administration';
END $$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT ip_hash FROM public.contact_messages WHERE id = (SELECT v::UUID FROM ctx2 WHERE k = 'msg')) IS NULL
     OR (SELECT ip_hash FROM public.contact_messages WHERE id = (SELECT v::UUID FROM ctx2 WHERE k = 'msg')) LIKE '%102.0.0.9%' THEN
    RAISE EXCEPTION 'FAIL client IP not hashed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id = '00000000-0000-0000-0000-0000000000c1' AND title = 'Nouveau message de contact') THEN
    RAISE EXCEPTION 'FAIL admins not notified';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contact_messages WHERE source = 'property') THEN
    RAISE EXCEPTION 'FAIL listing inquiries not centralized';
  END IF;
  RAISE NOTICE 'PASS admin notification + listing inquiries mirrored in the inbox';
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', FALSE);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.contact_messages) <> 1 OR (SELECT source FROM public.contact_messages LIMIT 1) <> 'agency' THEN
    RAISE EXCEPTION 'FAIL agency sees other messages or not its own';
  END IF;
  RAISE NOTICE 'PASS agency receives only messages addressed to it';
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', FALSE);
DO $$
DECLARE
  v_id UUID := (SELECT v::UUID FROM ctx2 WHERE k = 'msg');
  v_count INTEGER;
BEGIN
  IF ((public.admin_inbox_counts()) ->> 'unread')::INT <> 4 THEN
    RAISE EXCEPTION 'FAIL unread counter wrong: %', public.admin_inbox_counts();
  END IF;
  UPDATE public.contact_messages SET read_at = NOW() WHERE id = v_id;
  UPDATE public.contact_messages SET status = 'replied' WHERE id = v_id;
  INSERT INTO public.contact_message_notes (message_id, author_id, body) VALUES (v_id, auth.uid(), 'Rappelé par téléphone.');
  IF (SELECT replied_at FROM public.contact_messages WHERE id = v_id) IS NULL
     OR (SELECT count(*) FROM public.contact_message_history WHERE message_id = v_id) <> 3 THEN
    RAISE EXCEPTION 'FAIL workflow history incomplete';
  END IF;
  RAISE NOTICE 'PASS read / replied / note are journaled';

  BEGIN
    UPDATE public.contact_messages SET message = 'Message falsifié par un admin' WHERE id = v_id;
    RAISE EXCEPTION 'FAIL message content editable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.contact_messages SET assigned_to = '00000000-0000-0000-0000-0000000000a1' WHERE id = v_id;
    RAISE EXCEPTION 'FAIL message assigned to a non-admin';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  DELETE FROM public.contact_messages WHERE id = v_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL plain admin deleted a message (super_admin only)'; END IF;
  RAISE NOTICE 'PASS content immutable, assignment and deletion permissions enforced';
END $$;

-- ---------- Listing media ----------
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);
DO $$
DECLARE
  v_p UUID := (SELECT v::UUID FROM ctx2 WHERE k = 'p1');
  v_img UUID;
BEGIN
  BEGIN
    INSERT INTO public.property_images (property_id, url, storage_path, source)
    VALUES (v_p, 'x', 'properties/autre-annonce/photo.webp', 'upload');
    RAISE EXCEPTION 'FAIL client registered an uploaded file directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.property_images (property_id, url, source, external_url) VALUES (v_p, '', 'external', 'http://insecure.test/a.jpg');
    RAISE EXCEPTION 'FAIL non-https external image accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.property_images (property_id, url, source, external_url) VALUES (v_p, '', 'external', 'https://x.test/a.jpg" onerror="alert(1)');
    RAISE EXCEPTION 'FAIL external URL with quotes accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.property_images (property_id, url, source, external_url, sort_order)
  VALUES (v_p, 'ignored', 'external', 'https://images.example.com/maison.jpg', 1) RETURNING id INTO v_img;
  IF (SELECT url FROM public.property_images WHERE id = v_img) <> 'https://images.example.com/maison.jpg' THEN
    RAISE EXCEPTION 'FAIL external image url not normalized';
  END IF;
  INSERT INTO ctx2 VALUES ('img', v_img::TEXT);
  RAISE NOTICE 'PASS external images: https only, sanitized, uploads only through the service';

  INSERT INTO public.property_videos (property_id, url, source, provider_video_id) VALUES (v_p, 'x', 'youtube', 'dQw4w9WgXcQ');
  INSERT INTO public.property_videos (property_id, url, source, provider_video_id) VALUES (v_p, 'x', 'vimeo', '76979871');
  BEGIN
    INSERT INTO public.property_videos (property_id, url, source, provider_video_id) VALUES (v_p, 'x', 'youtube', '"><script>');
    RAISE EXCEPTION 'FAIL invalid YouTube id accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.property_videos (property_id, url, source) VALUES (v_p, 'https://evil.test/payload.exe', 'external');
    RAISE EXCEPTION 'FAIL arbitrary external video accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.property_videos (property_id, url, source) VALUES (v_p, 'https://cdn.example.com/visite.mp4', 'external');
  BEGIN
    INSERT INTO public.property_videos (property_id, url, source, provider_video_id) VALUES (v_p, 'x', 'youtube', 'aaaaaaaaaaa');
    RAISE EXCEPTION 'FAIL video limit not enforced';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  IF (SELECT url FROM public.property_videos WHERE provider_video_id = 'dQw4w9WgXcQ') <> 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' THEN
    RAISE EXCEPTION 'FAIL video url not rebuilt from the provider id';
  END IF;
  RAISE NOTICE 'PASS videos: YouTube/Vimeo/mp4 allow-list and per-listing limit';

  BEGIN
    UPDATE public.property_images SET moderation_status = 'approved', flag_count = 0 WHERE id = v_img;
    UPDATE public.property_images SET url = 'https://evil.test/x.jpg' WHERE id = v_img;
    RAISE EXCEPTION 'FAIL owner changed a media url after creation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.property_images SET sort_order = 0, is_primary = TRUE WHERE id = v_img;
  RAISE NOTICE 'PASS owner can reorder / choose the main image only';

  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('property-images', 'properties/' || v_p || '/direct.webp');
    RAISE EXCEPTION 'FAIL direct storage upload still possible';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS direct storage uploads are closed (signed upload URLs only)';
  END;
END $$;

RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.property_images WHERE id = (SELECT v::UUID FROM ctx2 WHERE k = 'img')) THEN
    RAISE EXCEPTION 'FAIL public cannot see approved media of a live listing';
  END IF;
  BEGIN
    PERFORM public.report_property_media('image', (SELECT v::UUID FROM ctx2 WHERE k = 'img'), 'Photo trompeuse');
    RAISE EXCEPTION 'FAIL anonymous report accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', FALSE);
SELECT public.report_property_media('image', (SELECT v::UUID FROM ctx2 WHERE k = 'img'), 'Photo trompeuse');
SELECT public.report_property_media('image', (SELECT v::UUID FROM ctx2 WHERE k = 'img'), 'Photo trompeuse encore');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', FALSE);
DO $$
BEGIN
  IF (SELECT flag_count FROM public.property_images WHERE id = (SELECT v::UUID FROM ctx2 WHERE k = 'img')) <> 1
     OR (SELECT moderation_status FROM public.property_images WHERE id = (SELECT v::UUID FROM ctx2 WHERE k = 'img')) <> 'flagged' THEN
    RAISE EXCEPTION 'FAIL report not counted once / not flagged';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.property_media WHERE moderation_status = 'flagged') THEN
    RAISE EXCEPTION 'FAIL admin media console view empty';
  END IF;
  PERFORM public.admin_moderate_media('image', (SELECT v::UUID FROM ctx2 WHERE k = 'img'), 'removed', 'Non conforme');
  RAISE NOTICE 'PASS media reports flag once, admin moderation';
END $$;
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', FALSE);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.property_images WHERE id = (SELECT v::UUID FROM ctx2 WHERE k = 'img')) THEN
    RAISE EXCEPTION 'FAIL removed media still public';
  END IF;
  RAISE NOTICE 'PASS removed media hidden from visitors';
END $$;

-- ---------- Profile photo ----------
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', FALSE);
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET avatar_url = 'https://evil.test/tracker.png' WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL arbitrary avatar URL accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET avatar_url = 'https://proj.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-0000000000a2/x.webp'
    WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL avatar of another user accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.profiles SET avatar_url = 'https://proj.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-0000000000a1/a1b2.webp'
  WHERE id = auth.uid();
  UPDATE public.profiles SET avatar_url = NULL WHERE id = auth.uid();
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', '00000000-0000-0000-0000-0000000000a1/direct.webp');
    RAISE EXCEPTION 'FAIL direct avatar upload possible';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS avatar: own folder only, removable, uploads via the service';
END $$;

-- ---------- Orphan detection ----------
RESET ROLE;
INSERT INTO storage.objects (bucket_id, name, created_at) VALUES
  ('property-images', 'properties/00000000-0000-0000-0000-000000000000/abandon.webp', NOW() - INTERVAL '2 days'),
  ('property-images', 'properties/00000000-0000-0000-0000-000000000000/recent.webp', NOW());
SET ROLE service_role;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.list_orphan_media_objects(INTERVAL '24 hours')) <> 1 THEN
    RAISE EXCEPTION 'FAIL orphan detection (only old unreferenced objects expected)';
  END IF;
  RAISE NOTICE 'PASS orphaned files detected for cleanup';
END $$;

RESET ROLE;
\echo 'ALL 019 TESTS PASSED'
