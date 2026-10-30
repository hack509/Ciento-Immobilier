-- =====================================================
-- Ciento-Immobilier: Messaging RPCs
-- =====================================================
-- Conversations are created and marked as read through SECURITY DEFINER
-- functions instead of direct table writes: a client cannot insert the
-- other participant's row under RLS (see 012), and must not be able to
-- rewrite messages it did not send.

-- =====================================================
-- 1. Messages: sender defaults to the caller
-- =====================================================
ALTER TABLE public.messages ALTER COLUMN sender_id SET DEFAULT auth.uid();

-- =====================================================
-- 2. start_conversation: find or create a 1:1 conversation
-- =====================================================
-- Reuses the existing conversation between the caller and the recipient
-- for the same property (or for no property), so repeated clicks on
-- "Envoyer un message" do not create duplicates.
CREATE OR REPLACE FUNCTION public.start_conversation(
  p_recipient_id UUID,
  p_property_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_conversation_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = v_caller THEN
    RAISE EXCEPTION 'Destinataire invalide' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_recipient_id AND is_active) THEN
    RAISE EXCEPTION 'Destinataire introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF p_property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM properties
    WHERE id = p_property_id
      AND ((is_published AND status = 'active') OR owner_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'Annonce introuvable' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.id INTO v_conversation_id
  FROM conversations c
  JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = v_caller
  JOIN conversation_participants other ON other.conversation_id = c.id AND other.user_id = p_recipient_id
  WHERE c.property_id IS NOT DISTINCT FROM p_property_id
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO conversations (property_id)
  VALUES (p_property_id)
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_caller), (v_conversation_id, p_recipient_id);

  RETURN v_conversation_id;
END;
$$;

-- =====================================================
-- 3. mark_conversation_read: only messages received by the caller
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'Conversation introuvable' USING ERRCODE = 'P0002';
  END IF;

  UPDATE messages
  SET status = 'read'
  WHERE conversation_id = p_conversation_id
    AND sender_id <> auth.uid()
    AND status <> 'read';
END;
$$;

REVOKE ALL ON FUNCTION public.start_conversation(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;

-- =====================================================
-- 4. Tighten direct writes
-- =====================================================
-- Conversations are only created through start_conversation().
DROP POLICY IF EXISTS "conversations_insert_own" ON public.conversations;

-- Participants could previously UPDATE any column of any message in
-- their conversations (including content). Read status now goes through
-- mark_conversation_read().
DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;

-- A sender may edit their own message but not move it elsewhere.
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );
