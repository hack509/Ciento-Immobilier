import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency: string = 'HTG'): string {
  const formatted = new Intl.NumberFormat('fr-HT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  if (currency === 'HTG') return `${formatted} HTG`;
  if (currency === 'USD') return `$${new Intl.NumberFormat('en-US').format(price)}`;
  return `${formatted} ${currency}`;
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('fr-HT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 7) return `Il y a ${diffD}j`;
  return formatDate(dateString);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getAvatarUrl(avatarUrl: string | null | undefined, fallback: string): string {
  return avatarUrl || fallback;
}

export function generatePropertyUrl(property: { slug: string; city?: { slug: string } }): string {
  const citySlug = property.city?.slug || 'gonaives';
  return `/annonces/${citySlug}/${property.slug}`;
}

export function getStatusColor(status: string): 'success' | 'warning' | 'primary' | 'default' | 'danger' {
  const colors: Record<string, 'success' | 'warning' | 'primary' | 'default' | 'danger'> = {
    active: 'success',
    pending: 'warning',
    sold: 'primary',
    rented: 'primary',
    draft: 'default',
    expired: 'danger',
    suspended: 'danger',
  };
  return colors[status] || 'default';
}

export function getListingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    sale: 'À vendre',
    rent: 'À louer',
    sale_or_rent: 'Vente ou Location',
  };
  return labels[type] || type;
}

export function getPropertyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    house: 'Maison',
    apartment: 'Appartement',
    land: 'Terrain',
    commercial: 'Local Commercial',
    building: 'Immeuble',
    villa: 'Villa',
  };
  return labels[type] || type;
}
