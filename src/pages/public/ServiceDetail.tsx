import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Head } from '@/components/seo/Head';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ServiceIcon } from '@/components/services/ServiceIcon';
import { useServiceCategory, useSubmitServiceRequest } from '@/hooks/useMarketplace';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/monetization';
import { formatPrice } from '@/lib/utils';

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: service, isLoading } = useServiceCategory(slug);
  const { profile } = useAuth();
  const submit = useSubmitServiceRequest();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    city: '',
    message: '',
    preferredContact: 'phone' as 'phone' | 'email' | 'whatsapp',
  });

  if (isLoading) return <LoadingSpinner size="lg" className="py-40" text="Chargement du service…" />;
  if (!service) {
    return (
      <div className="py-32 text-center">
        <Head title="Service introuvable" noindex />
        <h1 className="text-2xl font-bold text-primary-900">Service introuvable</h1>
        <Link to="/services" className="mt-6 inline-block"><Button>Voir tous les services</Button></Link>
      </div>
    );
  }

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Indiquez votre nom.';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Adresse e-mail invalide.';
    if (form.phone.trim().length < 6) next.phone = 'Indiquez un numéro joignable.';
    if (form.message.trim().length < 10) next.message = 'Décrivez votre besoin (10 caractères minimum).';
    setErrors(next);
    if (Object.keys(next).length === 0) submit.mutate({ categoryId: service.id, ...form });
  };

  return (
    <>
      <Head title={service.name} description={service.short_description} url={`/services/${service.slug}`} />
      <PageHero
        eyebrow="Service immobilier"
        title={service.name}
        subtitle={service.short_description}
        breadcrumbs={[{ label: 'Accueil', to: '/' }, { label: 'Services', to: '/services' }, { label: service.name }]}
        overlap
      />
      <div className="bg-gray-50 pb-20">
        <div className="mx-auto -mt-12 grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-5 lg:px-8">
          <article className="rounded-3xl bg-white p-6 shadow-card lg:col-span-3 lg:p-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-brand-yellow">
              <ServiceIcon name={service.icon} className="h-7 w-7" />
            </span>
            <p className="mt-6 whitespace-pre-line leading-relaxed text-gray-700">{service.description}</p>
            {service.deliverables.length > 0 && (
              <>
                <h2 className="mt-8 text-lg font-bold text-primary-900">Ce qui est inclus</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {service.deliverables.map((item) => (
                    <li key={item} className="flex items-start gap-2 rounded-xl bg-primary-50 p-3 text-sm text-primary-900">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" /> {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-8 text-sm font-semibold text-brand-blue">
              {service.starting_price ? `Tarif indicatif : à partir de ${formatPrice(service.starting_price, service.currency)}` : 'Tarif sur devis, après étude de votre demande.'}
            </p>
          </article>

          <aside className="lg:col-span-2">
            <div className="rounded-3xl bg-white p-6 shadow-card lg:sticky lg:top-24">
              <h2 className="text-lg font-bold text-primary-900">Demander ce service</h2>
              {submit.isSuccess ? (
                <div role="status" className="mt-4 flex gap-3 rounded-xl bg-success-50 p-4 text-sm text-success-700">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Merci ! Votre demande est enregistrée. Un conseiller vous contacte rapidement.
                </div>
              ) : (
                <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
                  <Input label="Nom complet" value={form.fullName} onChange={set('fullName')} error={errors.fullName} autoComplete="name" maxLength={120} />
                  <Input label="E-mail" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" maxLength={254} />
                  <Input label="Téléphone" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" maxLength={30} />
                  <Input label="Ville" value={form.city} onChange={set('city')} maxLength={80} />
                  <Select
                    label="Je préfère être contacté par"
                    value={form.preferredContact}
                    onChange={set('preferredContact')}
                    options={[{ value: 'phone', label: 'Téléphone' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'E-mail' }]}
                  />
                  <TextArea label="Votre projet" rows={4} value={form.message} onChange={set('message')} error={errors.message} maxLength={3000} />
                  {submit.isError && <p role="alert" className="text-sm text-danger-600">{errorMessage(submit.error)}</p>}
                  <Button type="submit" className="w-full" isLoading={submit.isPending} icon={<Send className="h-4 w-4" />}>
                    Envoyer ma demande
                  </Button>
                </form>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
