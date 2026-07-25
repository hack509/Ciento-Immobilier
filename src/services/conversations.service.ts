import { supabase } from './supabase';
import type { Conversation, Message } from '@/types';

class ConversationsService {
  async getAll(): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        updated_at,
        property_id,
        participants:conversation_participants(
          user:profiles(id, first_name, last_name, avatar_url)
        ),
        last_message:messages(
          id,
          content,
          status,
          created_at,
          sender:profiles(id, first_name, last_name)
        )
      `)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const conversations = (data || []) as Conversation[];

    // Extract last message from array (Supabase returns array for FK refs)
    return conversations.map((conv) => ({
      ...conv,
      last_message: Array.isArray(conv.last_message) ? conv.last_message[0] : conv.last_message,
      participants: Array.isArray(conv.participants)
        ? conv.participants.map((p: unknown) => (p as { user: import('@/types').Profile }).user)
        : [],
    }));
  }

  async getById(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        updated_at,
        property_id,
        participants:conversation_participants(
          user:profiles(id, first_name, last_name, avatar_url)
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error) return null;

    return {
      ...data,
      participants: Array.isArray(data.participants)
        ? data.participants.map((p: unknown) => (p as { user: import('@/types').Profile }).user)
        : [],
    } as Conversation;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles(id, first_name, last_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as Message[];
  }

  async create(propertyId: string | null, participantIds: string[]): Promise<Conversation> {
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({ property_id: propertyId })
      .select()
      .single();

    if (convError) throw convError;

    const participants = participantIds.map((userId) => ({
      conversation_id: conv.id,
      user_id: userId,
    }));

    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(participants);

    if (partError) throw partError;

    return conv as Conversation;
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
        sender:profiles(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data as Message;
  }

  async markAsRead(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('conversation_id', conversationId)
      .neq('status', 'read');

    if (error) throw error;
  }
}

export const conversationsService = new ConversationsService();
