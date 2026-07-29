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
    };
  };
}
