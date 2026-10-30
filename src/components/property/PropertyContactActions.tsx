import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useStartConversation } from '@/hooks/useConversations';
import type { Property } from '@/types';

interface PropertyContactActionsProps {
  property: Property;
}

/**
 * "Appeler" and "Envoyer un message" buttons for a listing.
 * The contact is the assigned agent when there is one, otherwise the owner.
 */
export function PropertyContactActions({ property }: PropertyContactActionsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const startConversation = useStartConversation();

  const contact = property.agent?.profile ?? property.owner;
  const isOwnListing = Boolean(user && contact?.id === user.id);

  const handleMessage = () => {
    if (!contact) return;
    if (!isAuthenticated) {
      navigate('/auth/connexion', { state: { from: location.pathname } });
      return;
    }
    startConversation.mutate(
      { recipientId: contact.id, propertyId: property.id },
      { onSuccess: (conversationId) => navigate(`/dashboard/messages?conversation=${conversationId}`) }
    );
  };

  return (
    <>
      {contact?.phone && (
        <Button
          className="w-full"
          icon={<Phone className="w-4 h-4" />}
          onClick={() => { window.location.href = `tel:${contact.phone}`; }}
        >
          Appeler
        </Button>
      )}
      {contact && !isOwnListing && (
        <Button
          variant="outline"
          className="w-full"
          icon={<Mail className="w-4 h-4" />}
          onClick={handleMessage}
          isLoading={startConversation.isPending}
        >
          Envoyer un message
        </Button>
      )}
      {startConversation.isError && (
        <p className="text-xs text-danger-600" role="alert">
          Impossible de démarrer la conversation. Veuillez réessayer.
        </p>
      )}
    </>
  );
}
