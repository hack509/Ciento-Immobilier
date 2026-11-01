export interface Database {
  public: {
    Tables: Record<string, {
      Row: Record<string, unknown>;
      Insert: Record<string, unknown>;
      Update: Record<string, unknown>;
      Relationships: { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[] }[];
    }>;
    Views: Record<string, never>;
    Functions: {
      increment_property_views: {
        Args: { property_id: string };
        Returns: unknown;
      };
      start_conversation: {
        Args: { p_recipient_id: string; p_property_id?: string | null };
        Returns: string;
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
      unsubscribe_newsletter: {
        Args: { p_token: string };
        Returns: boolean;
      };
    };
  };
}
