export type UserRole = 'super_admin' | 'admin' | 'agency' | 'agent' | 'owner' | 'client';

export type PropertyStatus = 'draft' | 'pending' | 'active' | 'sold' | 'rented' | 'expired' | 'suspended';

export type PropertyType = 'house' | 'apartment' | 'land' | 'commercial' | 'building' | 'villa';

export type ListingType = 'sale' | 'rent' | 'sale_or_rent';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export type MessageStatus = 'unread' | 'read' | 'archived';

export type NotificationType = 'message' | 'appointment' | 'property' | 'system' | 'review';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  bio?: string;
  address?: string;
  city_id?: string;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  department: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  created_at: string;
}

export interface Neighborhood {
  id: string;
  city_id: string;
  name: string;
  slug: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  created_at: string;
}

export interface Agency {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  cover_url?: string;
  email?: string;
  phone: string;
  whatsapp?: string;
  website?: string;
  address?: string;
  city_id?: string;
  neighborhood_id?: string;
  latitude?: number;
  longitude?: number;
  license_number?: string;
  is_verified: boolean;
  is_active: boolean;
  rating_avg: number;
  rating_count: number;
  properties_count: number;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  profile_id: string;
  agency_id?: string;
  license_number?: string;
  specializations: PropertyType[];
  experience_years: number;
  is_verified: boolean;
  is_active: boolean;
  rating_avg: number;
  rating_count: number;
  properties_count: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  agency?: Agency;
}

export interface Property {
  id: string;
  owner_id: string;
  agent_id?: string;
  agency_id?: string;
  category_id: string;
  city_id: string;
  neighborhood_id?: string;
  title: string;
  slug: string;
  description: string;
  property_type: PropertyType;
  listing_type: ListingType;
  status: PropertyStatus;
  price: number;
  price_currency: string;
  price_negotiable: boolean;
  price_per_sqm?: number;
  bedrooms: number;
  bathrooms: number;
  half_baths: number;
  total_rooms: number;
  land_area?: number;
  building_area?: number;
  floors: number;
  year_built?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  views_count: number;
  favorites_count: number;
  inquiries_count: number;
  meta_title?: string;
  meta_description?: string;
  is_featured: boolean;
  is_published: boolean;
  published_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  owner?: Profile;
  agent?: Agent;
  agency?: Agency;
  category?: Category;
  city?: City;
  neighborhood?: Neighborhood;
  images?: PropertyImage[];
  amenities?: Amenity[];
}

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  storage_path: string;
  alt_text?: string;
  sort_order: number;
  is_primary: boolean;
  width?: number;
  height?: number;
  created_at: string;
}

export interface PropertyVideo {
  id: string;
  property_id: string;
  url: string;
  storage_path?: string;
  thumbnail_url?: string;
  title?: string;
  duration_seconds?: number;
  sort_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Amenity {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
  property?: Property;
}

export interface Appointment {
  id: string;
  property_id: string;
  user_id: string;
  agent_id?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes?: string;
  contact_phone?: string;
  contact_name?: string;
  created_at: string;
  updated_at: string;
  property?: Property;
  user?: Profile;
  agent?: Agent;
}

export interface Conversation {
  id: string;
  property_id?: string;
  created_at: string;
  updated_at: string;
  participants?: Profile[];
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  status: MessageStatus;
  attachment_url?: string;
  created_at: string;
  sender?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  reviewer_id: string;
  target_id: string;
  target_type: 'agent' | 'agency';
  property_id?: string;
  rating: number;
  comment?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  reviewer?: Profile;
}

export interface BlogPost {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  cover_url?: string;
  is_published: boolean;
  published_at?: string;
  views_count: number;
  meta_title?: string;
  meta_description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface Transaction {
  id: string;
  property_id: string;
  buyer_id?: string;
  seller_id?: string;
  agent_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  payment_method?: string;
  reference_number?: string;
  notes?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'property' | 'user' | 'review' | 'message';
  target_id: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  key: string;
  value: unknown;
  description?: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface SearchFilters {
  query?: string;
  city_id?: string;
  neighborhood_id?: string;
  property_type?: PropertyType;
  listing_type?: ListingType;
  min_price?: number;
  max_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  min_area?: number;
  max_area?: number;
  amenities?: string[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
