-- =====================================================
-- Ciento-Immobilier: Admin moderation notifications
-- =====================================================
-- Owners submit listings as 'pending' (014). When an admin approves,
-- suspends or sends a listing back to review, the owner is notified.
-- Clients cannot insert notifications (012), so this runs as a
-- SECURITY DEFINER trigger.

CREATE OR REPLACE FUNCTION public.notify_property_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  -- Owners acting on their own listing do not notify themselves
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.owner_id THEN
    RETURN NULL;
  END IF;

  CASE NEW.status
    WHEN 'active' THEN
      v_title := 'Annonce approuvée';
      v_message := format('Votre annonce « %s » est maintenant en ligne.', NEW.title);
    WHEN 'suspended' THEN
      v_title := 'Annonce refusée';
      v_message := format('Votre annonce « %s » n''a pas été validée. Modifiez-la puis contactez-nous si besoin.', NEW.title);
    WHEN 'pending' THEN
      v_title := 'Annonce en cours de vérification';
      v_message := format('Votre annonce « %s » est de nouveau en attente de validation.', NEW.title);
    ELSE
      RETURN NULL;
  END CASE;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (NEW.owner_id, 'property', v_title, v_message, '/dashboard/annonces');

  RETURN NULL; -- AFTER trigger: return value is ignored
END;
$$;

REVOKE ALL ON FUNCTION public.notify_property_moderation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_property_moderation ON public.properties;
CREATE TRIGGER notify_property_moderation
  AFTER UPDATE OF status ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_property_moderation();
