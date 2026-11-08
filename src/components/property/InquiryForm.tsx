import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useSubmitInquiry } from '@/hooks/useMarketplace';
import { errorMessage } from '@/lib/monetization';

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/** Contact form available to every visitor (no account required), rate-limited server-side. */
export function InquiryForm({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) {
  const { profile } = useAuth();
  const submit = useSubmitInquiry();
  const [form, setForm] = useState({
    fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    message: `Bonjour, je suis intéressé(e) par « ${propertyTitle} ». Est-il toujours disponible ?`,
  });
  const [validation, setValidation] = useState('');

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.fullName.trim().length < 2) return setValidation('Indiquez votre nom.');
    if (!EMAIL_RE.test(form.email.trim())) return setValidation('Adresse e-mail invalide.');
    if (form.message.trim().length < 10) return setValidation('Votre message est trop court.');
    setValidation('');
    submit.mutate({ propertyId, ...form });
  };

  if (submit.isSuccess) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-success-50 p-4 text-sm text-success-700" role="status">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p>Votre demande a été transmise à l’annonceur. Il vous répondra par e-mail ou téléphone.</p>
      </div>
    );
  }

  const field = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-secondary-500 focus:outline-none focus:ring-2 focus:ring-secondary-500/20';
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <input aria-label="Nom complet" placeholder="Nom complet" autoComplete="name" value={form.fullName} onChange={set('fullName')} maxLength={120} className={field} />
      <input aria-label="E-mail" type="email" placeholder="E-mail" autoComplete="email" value={form.email} onChange={set('email')} maxLength={254} className={field} />
      <input aria-label="Téléphone (optionnel)" type="tel" placeholder="Téléphone (optionnel)" autoComplete="tel" value={form.phone} onChange={set('phone')} maxLength={30} className={field} />
      <textarea aria-label="Message" rows={4} value={form.message} onChange={set('message')} maxLength={2000} className={field} />
      {(validation || submit.isError) && (
        <p role="alert" className="text-xs text-danger-600">{validation || errorMessage(submit.error)}</p>
      )}
      <Button type="submit" className="w-full" icon={<Send className="h-4 w-4" />} isLoading={submit.isPending}>
        Envoyer ma demande
      </Button>
      <p className="text-[11px] leading-snug text-gray-400">
        Vos coordonnées sont transmises uniquement à l’annonceur de ce bien.
      </p>
    </form>
  );
}
