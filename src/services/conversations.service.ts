import { supabase } from './supabase';
import type { Conversation, Message, Profile } from '@/types';

class ConversationsService {
  async getAll(): Promise<Conversation[]> {
    const { data: rawData, error } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        updated_at,
        property_id,
        participants:conversation_participants(
          user:public_profiles!conversation_participants_user_id_fkey(id, first_name, last_name, avatar_url)
        ),
        last_message:messages(
          id,
          content,
          status,
          created_at,
          sender:public_profiles!messages_sender_id_fkey(id, first_name, last_name)
        )
      `)
      .order('updated_at', { ascending: false })
      .order('created_at', { referencedTable: 'last_message', ascending: false })
      .limit(1, { referencedTable: 'last_message' });

    if (error) throw error;

    const data = rawData as unknown as Conversation[] | null;
    const conversations = (data || []) as Conversation[];

    // Extract last message from array (Supabase returns array for FK refs)
    return conversations.map((conv) => ({
      ...conv,
      last_message: Array.isArray(conv.last_message) ? conv.last_message[0] : conv.last_message,
      participants: Array.isArray(conv.participants)
        ? conv.participants.map((p: unknown) => (p as { user: Profile }).user)
        : [],
    }));
  }

  async getById(conversationId: string): Promise<Conversation | null> {
    const { data: rawData, error } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        updated_at,
        property_id,
        participants:conversation_participants(
          user:public_profiles!conversation_participants_user_id_fkey(id, first_name, last_name, avatar_url)
        )
      `)
      .eq('id', conversationId)
      .maybeSingle();

    if (error) return null;

    const data = rawData as unknown as Conversation | null;
    if (!data) return null;

    return {
      ...data,
      participants: Array.isArray(data.participants)
        ? data.participants.map((p: unknown) => (p as { user: Profile }).user)
        : [],
    };
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:public_profiles!messages_sender_id_fkey(id, first_name, last_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as Message[];
  }

  /** Finds or creates the caller's conversation with a recipient; returns its id. */
  async start(recipientId: string, propertyId: string | null = null): Promise<string> {
    const { data, error } = await supabase.rpc('start_conversation', {
      p_recipient_id: recipientId,
      p_property_id: propertyId,
    });

    if (error) throw error;
    return data;
  }

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
      })
      .select(`
        *,
        sender:public_profiles!messages_sender_id_fkey(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data as Message;
  }

  /** Marks messages received by the caller as read (own messages are untouched). */
  async markAsRead(conversationId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
    });

    if (error) throw error;
  }
}

export const conversationsService = new ConversationsService();
