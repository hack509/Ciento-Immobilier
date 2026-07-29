import { getEnv } from './env';

export const APP_NAME = 'Ciento-Immobilier';
export const APP_DESCRIPTION = 'La première plateforme immobilière des Gonaïves, Haïti';
export const APP_URL = getEnv().appUrl;

export const CURRENCY = 'HTG';
export const CURRENCY_SYMBOL = 'HTG';

export const PROPERTY_TYPES = [
  { value: 'house', label: 'Maison' },
  { value: 'apartment', label: 'Appartement' },
  { value: 'land', label: 'Terrain' },
  { value: 'commercial', label: 'Local Commercial' },
  { value: 'building', label: 'Immeuble' },
  { value: 'villa', label: 'Villa' },
] as const;

export const LISTING_TYPES = [
  { value: 'sale', label: 'À vendre' },
  { value: 'rent', label: 'À louer' },
  { value: 'sale_or_rent', label: 'Vente ou Location' },
] as const;

export const PROPERTY_STATUSES = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'pending', label: 'En attente' },
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Vendu' },
  { value: 'rented', label: 'Loué' },
  { value: 'expired', label: 'Expiré' },
  { value: 'suspended', label: 'Suspendu' },
] as const;

export const USER_ROLES = [
  { value: 'super_admin', label: 'Super Administrateur' },
  { value: 'admin', label: 'Administrateur' },
  { value: 'agency', label: 'Agence' },
  { value: 'agent', label: 'Agent Immobilier' },
  { value: 'owner', label: 'Propriétaire' },
  { value: 'client', label: 'Client' },
] as const;

export const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=C+I&background=1E3A5F&color=fff&size=128';

export const ITEMS_PER_PAGE = 12;

export const PRICE_RANGES = [
  { label: 'Moins de 500,000 HTG', min: 0, max: 500000 },
  { label: '500,000 - 1,000,000 HTG', min: 500000, max: 1000000 },
  { label: '1,000,000 - 2,000,000 HTG', min: 1000000, max: 2000000 },
  { label: '2,000,000 - 5,000,000 HTG', min: 2000000, max: 5000000 },
  { label: 'Plus de 5,000,000 HTG', min: 5000000, max: undefined },
] as const;

export const BEDROOM_OPTIONS = [
  { value: 1, label: '1+' },
  { value: 2, label: '2+' },
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
  { value: 5, label: '5+' },
] as const;
