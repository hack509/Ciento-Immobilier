import { Calculator, ClipboardCheck, KeyRound, Tag, Building2, Handshake, Lightbulb, Briefcase } from 'lucide-react';

const ICONS = {
  calculator: Calculator,
  'clipboard-check': ClipboardCheck,
  'key-round': KeyRound,
  tag: Tag,
  'building-2': Building2,
  handshake: Handshake,
  lightbulb: Lightbulb,
} as const;

/** Maps the icon name stored in service_categories.icon to a Lucide icon. */
export function ServiceIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name as keyof typeof ICONS]) || Briefcase;
  return <Icon className={className} aria-hidden="true" />;
}
