import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useConversations, useMessages, useSendMessage, useMarkAsRead } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Conversation, Message } from '@/types';

export function Messages() {
  const { profile } = useAuth();
  const { data: conversations, isLoading } = useConversations();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [showMobileMessages, setShowMobileMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: messages } = useMessages(selectedConv || '');
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const [newMessage, setNewMessage] = useState('');

  const handleSelectConversation = (convId: string) => {
    setSelectedConv(convId);
    setShowMobileMessages(true);
    markAsRead.mutate(convId);
  };

  const handleBackToList = () => {
    setShowMobileMessages(false);
  };

  const handleSend = () => {
    if (!newMessage.trim() || !selectedConv) return;
    sendMessage.mutate({ conversationId: selectedConv, content: newMessage.trim() });
    setNewMessage('');
  };

  const getOtherParticipant = (conv: Conversation) => {
    if (!conv.participants) return null;
    return conv.participants.find((p) => p.id !== profile?.id);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedConversation = selectedConv
    ? conversations?.find((c) => c.id === selectedConv)
    : null;
  const otherParticipant = selectedConversation ? getOtherParticipant(selectedConversation) : null;

  if (isLoading) {
    return <LoadingSpinner size="lg" text="Chargement..." className="py-20" />;
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Messages</h1>
        <EmptyState
          icon={<MessageSquare className="w-8 h-8" />}
          title="Aucune conversation"
          description="Vous n'avez pas encore de messages. Contactez un agent pour démarrer une conversation."
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Messages</h1>
      <p className="text-gray-500 text-sm mb-6">{conversations.length} conversation{conversations.length > 1 ? 's' : ''}</p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex" style={{ height: '600px' }}>
        {/* Conversations List — hidden on mobile when viewing a conversation */}
        <div className={cn(
          'w-full sm:w-80 border-r border-gray-200 overflow-y-auto shrink-0',
          showMobileMessages && 'hidden sm:block'
        )}>
          {conversations.map((conv) => {
            const other = getOtherParticipant(conv);
            const isSelected = selectedConv === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                  isSelected && 'bg-secondary-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary-100 rounded-full flex items-center justify-center text-secondary-700 font-medium text-sm shrink-0">
                    {other?.first_name?.[0]}{other?.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {other?.first_name} {other?.last_name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {conv.last_message ? conv.last_message.content : 'Aucun message'}
                    </div>
                  </div>
                  {conv.last_message && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatRelativeTime(conv.last_message.created_at)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Messages Area — hidden on mobile when no conversation selected */}
        {(!showMobileMessages && selectedConv === null) ? (
          <div className={cn(
            'flex-1 hidden sm:flex items-center justify-center text-gray-400 text-sm'
          )}>
            Sélectionnez une conversation
          </div>
        ) : (
          <div className={cn(
            'flex-1 flex flex-col',
            selectedConv === null && 'hidden sm:flex'
          )}>
            {selectedConv ? (
              <>
                {/* Mobile conversation header with back button */}
                <div className="sm:hidden flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white">
                  <button
                    onClick={handleBackToList}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-600"
                    aria-label="Retour à la liste"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 bg-secondary-100 rounded-full flex items-center justify-center text-secondary-700 font-medium text-xs shrink-0">
                    {otherParticipant?.first_name?.[0]}{otherParticipant?.last_name?.[0]}
                  </div>
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {otherParticipant?.first_name} {otherParticipant?.last_name}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(messages || []).map((msg: Message) => {
                    const isOwn = msg.sender_id === profile?.id;
                    return (
                      <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[85%] sm:max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm',
                          isOwn
                            ? 'bg-secondary-500 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        )}>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn('text-xs mt-1', isOwn ? 'text-secondary-200' : 'text-gray-400')}>
                            {formatRelativeTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-gray-200 p-3 sm:p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Écrivez votre message..."
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim()}
                      className="p-2.5 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="hidden sm:flex flex-1 items-center justify-center text-gray-400 text-sm">
                Sélectionnez une conversation
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
