import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
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
  const { data: messages } = useMessages(selectedConv || '');
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const [newMessage, setNewMessage] = useState('');

  const handleSelectConversation = (convId: string) => {
    setSelectedConv(convId);
    markAsRead.mutate(convId);
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
        {/* Conversations List */}
        <div className="w-full sm:w-80 border-r border-gray-200 overflow-y-auto">
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

        {/* Messages Area */}
        <div className="hidden sm:flex flex-col flex-1">
          {selectedConv ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(messages || []).map((msg: Message) => {
                  const isOwn = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm',
                        isOwn
                          ? 'bg-secondary-500 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      )}>
                        <p>{msg.content}</p>
                        <p className={cn('text-xs mt-1', isOwn ? 'text-secondary-200' : 'text-gray-400')}>
                          {formatRelativeTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-200 p-4">
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
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Sélectionnez une conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
