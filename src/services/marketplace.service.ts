import { supabase } from './supabase';
import { storageService } from './storage.service';
import type { Agency, Property } from '@/types';
import type {
  AgencyMember, AgencyMemberRole, InquiryStatus, ListingStats, MyAgency, PropertyInquiry, PublicTeamMember,
  QuotaSummary,
} from '@/types/marketplace';
import { slugify } from '@/lib/utils';

const BRAND_BUCKET = 'brand-assets';
const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type AgencyInput = Pick<Agency, 'name' | 'phone'> &
  Partial<Pick<Agency, 'description' | 'email' | 'whatsapp' | 'website' | 'address' | 'city_id' |
    'license_number' | 'tagline' | 'brand_color' | 'team_intro' | 'logo_url' | 'cover_url'>>;

class MarketplaceService {
  // ---------------------------------------------------------------- Agencies
  /** Agencies the user owns or belongs to, with the effective permissions. */
  async getMyAgencies(userId: string): Promise<MyAgency[]> {
    const [owned, memberships] = await Promise.all([
      supabase.from('agencies').select('*').eq('owner_id', userId),
      supabase.from('agency_members').select('*, agency:agencies(*)').eq('profile_id', userId).eq('is_active', true),
    ]);
    if (owned.error) throw owned.error;
    if (memberships.error) throw memberships.error;

    const result: MyAgency[] = (owned.data as Agency[]).map((agency) => ({
      agency, isOwner: true, role: 'owner', canPublish: true, canManageLeads: true, canManageBilling: true, canManageTeam: true,
    }));
    for (const m of (memberships.data || []) as (AgencyMember & { agency: Agency | null })[]) {
      if (!m.agency || result.some((r) => r.agency.id === m.agency_id)) continue;
      const manager = m.member_role === 'manager';
      result.push({
        agency: m.agency,
        isOwner: false,
        role: m.member_role,
        canPublish: manager || m.can_publish,
        canManageLeads: manager || m.can_manage_leads,
        canManageBilling: manager || m.can_manage_billing,
        canManageTeam: manager,
      });
    }
    return result;
  }

  async createAgency(ownerId: string, input: AgencyInput): Promise<Agency> {
    const slug = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from('agencies')
      .insert({ ...input, owner_id: ownerId, slug })
      .select()
      .single();
    if (error) throw error;
    await supabase.rpc('request_agency_verification', { p_agency_id: (data as Agency).id });
    return data as Agency;
  }

  async updateAgency(id: string, input: Partial<AgencyInput>): Promise<Agency> {
    const { data, error } = await supabase.from('agencies').update(input).eq('id', id).select().single();
    if (error) throw error;
    return data as Agency;
  }

  async requestVerification(agencyId: string): Promise<void> {
    const { error } = await supabase.rpc('request_agency_verification', { p_agency_id: agencyId });
    if (error) throw error;
  }

  async uploadAgencyImage(agencyId: string, file: File, kind: 'logo' | 'cover'): Promise<string> {
    if (!LOGO_TYPES.includes(file.type)) throw new Error('Format accepté : JPEG, PNG ou WebP.');
    if (file.size > MAX_LOGO_SIZE) throw new Error('Image trop volumineuse (2 Mo maximum).');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `agencies/${agencyId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BRAND_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from(BRAND_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async getAgencyMembers(agencyId: string): Promise<AgencyMember[]> {
    const { data, error } = await supabase
      .from('agency_members')
      .select('*, profile:profiles!agency_members_profile_id_fkey(id, first_name, last_name, email, avatar_url)')
      .eq('agency_id', agencyId)
      .order('created_at');
    if (error) throw error;
    return (data || []) as AgencyMember[];
  }

  async addAgencyMember(agencyId: string, email: string, role: AgencyMemberRole, title?: string): Promise<string> {
    const { data, error } = await supabase.rpc('add_agency_member', {
      p_agency_id: agencyId, p_email: email.trim(), p_role: role, p_title: title || null,
    });
    if (error) throw error;
    return data as string;
  }

  async updateAgencyMember(
    id: string,
    changes: Partial<Pick<AgencyMember, 'member_role' | 'title' | 'can_publish' | 'can_manage_leads' | 'can_manage_billing' | 'is_active'>>,
  ): Promise<void> {
    const { error } = await supabase.from('agency_members').update(changes).eq('id', id);
    if (error) throw error;
  }

  async removeAgencyMember(id: string): Promise<void> {
    const { error } = await supabase.from('agency_members').delete().eq('id', id);
    if (error) throw error;
  }

  /** Portfolio of an agency (RLS: members only). */
  async getAgencyPortfolio(agencyId: string, status?: string): Promise<Property[]> {
    let query = supabase
      .from('properties')
      .select(`*, city:cities!properties_city_id_fkey(id, name, slug),
               images:property_images!property_images_property_id_fkey(url, storage_path, alt_text, is_primary, sort_order)`)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return this.signImages((data || []) as Property[]);
  }

  // ---------------------------------------------------------------- Public agency pages
  async getPublicAgencies(): Promise<Agency[]> {
    const { data, error } = await supabase
      .from('agencies')
      .select('*, city:cities(name, slug)')
      .eq('is_active', true)
      .eq('is_verified', true)
      .order('properties_count', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []) as Agency[];
  }

  async getPublicAgency(slug: string): Promise<Agency | null> {
    const { data, error } = await supabase
      .from('agencies')
      .select('*, city:cities(name, slug)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as Agency | null) ?? null;
  }

  async getPublicTeam(agencyId: string): Promise<PublicTeamMember[]> {
    const { data, error } = await supabase
      .from('public_agency_team')
      .select('*')
      .eq('agency_id', agencyId)
      .order('member_role');
    if (error) throw error;
    return (data || []) as PublicTeamMember[];
  }

  async getAgencyPublicListings(agencyId: string): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select(`*, city:cities!properties_city_id_fkey(id, name, slug),
               neighborhood:neighborhoods!properties_neighborhood_id_fkey(id, name, slug),
               images:property_images!property_images_property_id_fkey(url, storage_path, alt_text, is_primary, sort_order)`)
      .eq('agency_id', agencyId)
      .eq('is_published', true)
      .eq('status', 'active')
      .order('sponsored_until', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    return this.signImages((data || []) as Property[]);
  }

  // ---------------------------------------------------------------- Inquiries (leads)
  async submitInquiry(input: { propertyId: string; fullName: string; email: string; phone?: string; message: string }) {
    const { data, error } = await supabase.rpc('submit_property_inquiry', {
      p_property_id: input.propertyId,
      p_full_name: input.fullName,
      p_email: input.email,
      p_phone: input.phone || null,
      p_message: input.message,
    });
    if (error) throw error;
    return data as string;
  }

  async getInquiries(scope: { agencyId?: string | null; userId: string; status?: InquiryStatus | '' }): Promise<PropertyInquiry[]> {
    let query = supabase
      .from('property_inquiries')
      .select('*, property:properties(id, title, slug, city:cities!properties_city_id_fkey(slug))')
      .order('created_at', { ascending: false })
      .limit(200);
    query = scope.agencyId ? query.eq('agency_id', scope.agencyId) : query.eq('recipient_id', scope.userId);
    if (scope.status) query = query.eq('status', scope.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as PropertyInquiry[];
  }

  async updateInquiry(id: string, changes: { status?: InquiryStatus; notes?: string | null }): Promise<void> {
    const { error } = await supabase.from('property_inquiries').update(changes).eq('id', id);
    if (error) throw error;
  }

  // ---------------------------------------------------------------- Stats & quota
  async getListingStats(agencyId: string | null, days = 30): Promise<ListingStats> {
    const { data, error } = await supabase.rpc('get_listing_stats', { p_agency_id: agencyId, p_days: days });
    if (error) throw error;
    return data as ListingStats;
  }

  async getQuota(agencyId: string | null): Promise<QuotaSummary> {
    const { data, error } = await supabase.rpc('get_my_quota', { p_agency_id: agencyId });
    if (error) throw error;
    return data as QuotaSummary;
  }

  private async signImages(properties: Property[]): Promise<Property[]> {
    return Promise.all(properties.map(async (p) => ({
      ...p,
      images: await Promise.all((p.images || []).map(async (img) => ({
        ...img, url: await storageService.getSignedUrl(img.storage_path).catch(() => img.url),
      }))),
    })));
  }
}

export const marketplaceService = new MarketplaceService();
