import { supabase } from './supabase';
import type { AdPlacement, PublicAd, ServiceCategory } from '@/types/marketplace';

export interface ServiceRequestInput {
  categoryId: string;
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  message: string;
  preferredContact: 'phone' | 'email' | 'whatsapp';
  propertyId?: string | null;
}

const SESSION_KEY = 'ciento-ad-session';

/** Random per-tab identifier used only to de-duplicate ad impressions. */
function adSession(): string {
  try {
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, value);
    }
    return value;
  } catch {
    return 'no-storage';
  }
}

class CatalogService {
  async getServiceCategories(): Promise<ServiceCategory[]> {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return (data || []) as ServiceCategory[];
  }

  async getServiceCategory(slug: string): Promise<ServiceCategory | null> {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return (data as ServiceCategory) || null;
  }

  async submitServiceRequest(input: ServiceRequestInput): Promise<string> {
    const { data, error } = await supabase.rpc('submit_service_request', {
      p_category_id: input.categoryId,
      p_full_name: input.fullName,
      p_email: input.email,
      p_phone: input.phone,
      p_city: input.city || null,
      p_message: input.message,
      p_preferred_contact: input.preferredContact,
      p_property_id: input.propertyId || null,
    });
    if (error) throw error;
    return data as string;
  }

  async getMyServiceRequests() {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*, category:service_categories(id, name, slug)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }

  async getAds(placement: AdPlacement): Promise<PublicAd[]> {
    const { data, error } = await supabase
      .from('active_ad_campaigns')
      .select('*')
      .eq('placement', placement)
      .order('priority', { ascending: false })
      .limit(3);
    if (error) throw error;
    return (data || []) as PublicAd[];
  }

  trackAd(campaignId: string, event: 'impression' | 'click'): void {
    void supabase.rpc('track_ad_event', {
      p_campaign_id: campaignId,
      p_event: event,
      p_session: adSession(),
      p_path: window.location.pathname,
    });
  }
}

export const catalogService = new CatalogService();
