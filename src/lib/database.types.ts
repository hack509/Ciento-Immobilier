/** Marketplace RPCs (migrations 016-018): arguments are validated server-side. */
type MarketplaceRpc = { Args: Record<string, unknown>; Returns: unknown };

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
      admin_marketplace_stats: MarketplaceRpc;
      admin_set_agency_status: MarketplaceRpc;
      admin_confirm_payment: MarketplaceRpc;
      admin_refund_payment: MarketplaceRpc;
      admin_cancel_promotion: MarketplaceRpc;
      admin_financial_report: MarketplaceRpc;
      run_marketplace_maintenance: MarketplaceRpc;
      checkout_subscription: MarketplaceRpc;
      checkout_subscription_renewal: MarketplaceRpc;
      checkout_promotion: MarketplaceRpc;
      start_subscription_trial: MarketplaceRpc;
      set_subscription_cancellation: MarketplaceRpc;
      redeem_sponsored_credit: MarketplaceRpc;
      cancel_my_payment: MarketplaceRpc;
      submit_service_request: MarketplaceRpc;
      track_ad_event: MarketplaceRpc;
      request_agency_verification: MarketplaceRpc;
      add_agency_member: MarketplaceRpc;
      submit_property_inquiry: MarketplaceRpc;
      get_listing_stats: MarketplaceRpc;
      get_my_quota: MarketplaceRpc;
      report_property_media: MarketplaceRpc;
      admin_moderate_media: MarketplaceRpc;
      admin_newsletter_stats: MarketplaceRpc;
      admin_start_newsletter_campaign: MarketplaceRpc;
      admin_inbox_counts: MarketplaceRpc;
      submit_contact_message: MarketplaceRpc;
      media_limit: MarketplaceRpc;
      is_admin: MarketplaceRpc;
      unsubscribe_newsletter: {
        Args: { p_token: string };
        Returns: boolean;
      };
    };
  };
}
