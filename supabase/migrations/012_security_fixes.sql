-- =====================================================
-- Ciento-Immobilier: Security fixes
-- =====================================================
-- 1. Privilege escalation via signup metadata and self-update of role
-- 2. Recursive / permissive conversation_participants policies
-- 3. Unrestricted notification inserts
-- 4. Storage objects writable by any authenticated user
-- 5. SECURITY DEFINER helpers without a fixed search_path

-- =====================================================
-- 1. Harden RLS helper functions (fixed search_path)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role() IN ('super_admin', 'admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role() = 'super_admin', false);
$$;

-- =====================================================
-- 2. Signup: never trust the role sent by the client
-- =====================================================
-- Only self-declared, non-privileged roles are accepted from
-- user metadata. agent / agency / admin roles are granted by an admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := NEW.raw_user_meta_data->>'role';
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN requested_role IN ('client', 'owner') THEN requested_role::user_role
      ELSE 'client'::user_role
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- =====================================================
-- 3. Profiles: protect privileged columns on update
-- =====================================================
-- RLS cannot compare OLD and NEW values, so a trigger enforces that
-- role / is_verified / is_active are only changed by admins, and that
-- admin roles are only granted by a super_admin.
-- auth.uid() IS NULL means service_role or SQL editor: allowed.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Modification du rôle non autorisée' USING ERRCODE = '42501';
    END IF;
    IF (NEW.role IN ('admin', 'super_admin') OR OLD.role IN ('admin', 'super_admin'))
       AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Seul un super_admin peut gérer les rôles administrateur' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF (NEW.is_verified IS DISTINCT FROM OLD.is_verified
      OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Modification du statut du compte non autorisée' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- 4. Conversations: non-recursive participant checks
-- =====================================================
-- The previous conversation_participants SELECT policy queried its own
-- table (infinite recursion), and the INSERT policy let any user join
-- any conversation. Membership is now checked through a SECURITY DEFINER
-- helper, and participants are no longer inserted directly by clients
-- (conversation creation moves to an RPC).
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "conv_participants_select_own" ON public.conversation_participants;
CREATE POLICY "conv_participants_select_own" ON public.conversation_participants
  FOR SELECT USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "conv_participants_insert_own" ON public.conversation_participants;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant" ON public.conversations
  FOR SELECT USING (public.is_conversation_participant(id));

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;
CREATE POLICY "messages_update_participant" ON public.messages
  FOR UPDATE USING (public.is_conversation_participant(conversation_id))
  WITH CHECK (public.is_conversation_participant(conversation_id));

-- =====================================================
-- 5. Notifications: no direct inserts from clients
-- =====================================================
-- Notifications are created by SECURITY DEFINER trigger functions
-- (migration 006), which bypass RLS.
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;

-- =====================================================
-- 6. Storage: restrict property-images writes to the property owner
-- =====================================================
-- Object paths follow properties/{property_id}/{file} (storage.service.ts).
CREATE OR REPLACE FUNCTION public.can_manage_property_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() OR (
    (storage.foldername(object_name))[1] = 'properties'
    AND EXISTS (
      SELECT 1 FROM public.properties
      WHERE id::text = (storage.foldername(object_name))[2]
        AND owner_id = auth.uid()
    )
  );
$$;

DROP POLICY IF EXISTS "property_images_auth_insert" ON storage.objects;
CREATE POLICY "property_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND public.can_manage_property_object(name)
  );

DROP POLICY IF EXISTS "property_images_auth_update" ON storage.objects;
CREATE POLICY "property_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND public.can_manage_property_object(name)
  )
  WITH CHECK (
    bucket_id = 'property-images'
    AND public.can_manage_property_object(name)
  );

DROP POLICY IF EXISTS "property_images_auth_delete" ON storage.objects;
CREATE POLICY "property_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND public.can_manage_property_object(name)
  );

-- =====================================================
-- 7. Fix property counter triggers (missing RETURN)
-- =====================================================
-- When agency_id / agent_id was NULL on INSERT or DELETE, the functions
-- fell through without RETURN, aborting the statement: properties
-- without an agency or agent could not be created or deleted.
CREATE OR REPLACE FUNCTION public.update_agency_properties_count()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.agency_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.agency_id IS DISTINCT FROM NEW.agency_id) THEN
    UPDATE agencies SET properties_count = properties_count - 1 WHERE id = OLD.agency_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.agency_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.agency_id IS DISTINCT FROM NEW.agency_id) THEN
    UPDATE agencies SET properties_count = properties_count + 1 WHERE id = NEW.agency_id;
  END IF;
  RETURN NULL; -- AFTER trigger: return value is ignored
END;
$$;

CREATE OR REPLACE FUNCTION public.update_agent_properties_count()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.agent_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.agent_id IS DISTINCT FROM NEW.agent_id) THEN
    UPDATE agents SET properties_count = properties_count - 1 WHERE id = OLD.agent_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.agent_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.agent_id IS DISTINCT FROM NEW.agent_id) THEN
    UPDATE agents SET properties_count = properties_count + 1 WHERE id = NEW.agent_id;
  END IF;
  RETURN NULL; -- AFTER trigger: return value is ignored
END;
$$;
