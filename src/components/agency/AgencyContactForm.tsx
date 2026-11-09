import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { inboxService } from '@/services/inbox.service';
import { errorMessage } from '@/lib/monetization';

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const field = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-secondary-500 focus:outline-none focus:ring-2 focus:ring-secondary-500/20';

/** Message to an agency (delivered to the agency and recorded in the admin inbox). */
export function AgencyContactForm({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    if (form.fullName.trim().length < 2) return setError('Indiquez votre nom.');
    if (!EMAIL_RE.test(form.email.trim())) return setError('Adresse e-mail invalide.');
    if (form.message.trim().length < 10) return setError('Votre message est trop court.');
    setError('');
    setStatus('sending');
    try {
      await inboxService.submit({ ...form, subject: `Contact agence — ${agencyName}`.slice(0, 150), source: 'agency', agencyId });
      setStatus('sent');
    } catch (err) {
      setError(errorMessage(err));
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return <p role="status" className="flex gap-2 rounded-xl bg-success-50 p-3 text-sm text-success-700"><CheckCircle2 className="h-5 w-5 shrink-0" />Message envoyé à l’agence.</p>;
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <input aria-label="Nom complet" placeholder="Nom complet" value={form.fullName} onChange={set('fullName')} maxLength={120} className={field} autoComplete="name" />
      <input aria-label="E-mail" type="email" placeholder="E-mail" value={form.email} onChange={set('email')} maxLength={254} className={field} autoComplete="email" />
      <input aria-label="Téléphone (optionnel)" type="tel" placeholder="Téléphone (optionnel)" value={form.phone} onChange={set('phone')} maxLength={30} className={field} autoComplete="tel" />
      <textarea aria-label="Message" rows={4} placeholder="Votre message…" value={form.message} onChange={set('message')} maxLength={5000} className={field} />
      {error && <p role="alert" className="text-xs text-danger-600">{error}</p>}
      <Button type="submit" className="w-full" isLoading={status === 'sending'} icon={<Send className="h-4 w-4" />}>Envoyer</Button>
    </form>
  );
}
