import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, Clock, ExternalLink, ImagePlus, Save, ShieldAlert, Users, Briefcase } from 'lucide-react';
import { PageHeader, Panel, StatCard } from '@/components/dashboard/DashboardUI';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { VerifiedBadge } from '@/components/ui/PromoBadges';
import { useCities } from '@/hooks/useCities';
import { useCreateAgency, useMyAgencies, useQuota, useUpdateAgency } from '@/hooks/useMarketplace';
import { marketplaceService, type AgencyInput } from '@/services/marketplace.service';
import { errorMessage } from '@/lib/monetization';

const EMPTY: AgencyInput = {
  name: '', phone: '', email: '', whatsapp: '', website: '', address: '', city_id: '', description: '',
  license_number: '', tagline: '', team_intro: '', brand_color: '',
};

/** Cleans optional fields: empty strings become null so database checks stay meaningful. */
function normalize(input: AgencyInput): AgencyInput {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = typeof v === 'string' ? (v.trim() || null) : v;
  return out as AgencyInput;
}

export function AgencySpace() {
  const { data: agencies, isLoading } = useMyAgencies();
  const membership = agencies?.[0];
  const agency = membership?.agency;
  const { data: cities } = useCities();
  const { data: quota } = useQuota(agency?.id ?? null);
  const create = useCreateAgency();
  const update = useUpdateAgency();
  const [form, setForm] = useState<AgencyInput>(EMPTY);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);
  const [saved, setSaved] = useState(false);
  const customPage = Boolean(quota?.capabilities?.custom_page);
  const canEdit = !agency || membership?.canManageTeam;

  useEffect(() => {
    if (!agency) return;
    setForm({
      name: agency.name, phone: agency.phone, email: agency.email ?? '', whatsapp: agency.whatsapp ?? '',
      website: agency.website ?? '', address: agency.address ?? '', city_id: agency.city_id ?? '',
      description: agency.description ?? '', license_number: agency.license_number ?? '', tagline: agency.tagline ?? '',
      team_intro: agency.team_intro ?? '', brand_color: agency.brand_color ?? '',
      logo_url: agency.logo_url, cover_url: agency.cover_url,
    });
  }, [agency]);

  const set = (field: keyof AgencyInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setSaved(false);
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const values = normalize(form);
    if (!customPage) delete values.brand_color;
    if (agency) update.mutate({ id: agency.id, input: values }, { onSuccess: () => setSaved(true) });
    else create.mutate(values, { onSuccess: () => setSaved(true) });
  };

  const onUpload = async (kind: 'logo' | 'cover', file?: File) => {
    if (!agency || !file) return;
    setUploadError('');
    setUploading(kind);
    try {
      const url = await marketplaceService.uploadAgencyImage(agency.id, file, kind);
      await update.mutateAsync({ id: agency.id, input: kind === 'logo' ? { logo_url: url } : { cover_url: url } });
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) return <LoadingSpinner className="py-24" />;
  const error = create.error || update.error;

  return (
    <div>
      <PageHeader
        title={agency ? agency.name : 'Créer mon agence'}
        subtitle={agency ? 'Profil professionnel et page publique de votre agence.' : 'Présentez votre agence et publiez votre portefeuille sur Ciento-Immobilier.'}
        actions={agency?.is_verified ? (
          <Link to={`/agences/${agency.slug}`} target="_blank"><Button variant="outline" icon={<ExternalLink className="h-4 w-4" />}>Voir la page publique</Button></Link>
        ) : null}
      />

      {agency && (
        <>
          {agency.is_verified ? (
            <p className="mb-5 flex items-center gap-2 rounded-2xl bg-success-50 p-4 text-sm text-success-700"><VerifiedBadge label="Agence vérifiée" /> Votre agence apparaît dans l’annuaire public.</p>
          ) : !agency.is_active ? (
            <p className="mb-5 flex items-center gap-2 rounded-2xl bg-danger-50 p-4 text-sm text-danger-600"><ShieldAlert className="h-5 w-5" /> Votre agence est suspendue. Contactez l’équipe Ciento-Immobilier.</p>
          ) : (
            <p className="mb-5 flex items-center gap-2 rounded-2xl bg-warning-50 p-4 text-sm text-warning-700"><Clock className="h-5 w-5" /> Votre agence est en cours de validation par notre équipe.</p>
          )}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Building} label="Annonces actives / en attente" value={quota?.used} hint={`Limite : ${quota?.limit ?? 'illimitée'}`} tone="navy" to="/dashboard/agence/portefeuille" />
            <StatCard icon={Users} label="Places d’équipe" value={quota?.member_limit ?? undefined} hint={quota?.member_limit == null ? 'Illimité' : undefined} to="/dashboard/agence/equipe" />
            <StatCard icon={Briefcase} label="Formule" value={undefined} hint={quota?.plan_name ?? 'Gratuite'} to="/dashboard/abonnement?espace=agence" />
            <StatCard icon={ImagePlus} label="Crédits de mise en avant" value={quota?.featured_credits} tone="gold" to="/dashboard/promotions?espace=agence" />
          </div>
        </>
      )}

      {!canEdit ? (
        <Panel><p className="p-6 text-sm text-gray-600">Seuls le titulaire et les gestionnaires peuvent modifier le profil de l’agence.</p></Panel>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          {agency && (
            <Panel title="Identité visuelle">
              <div className="grid gap-6 p-5 sm:grid-cols-2">
                {(['logo', 'cover'] as const).map((kind) => {
                  const url = kind === 'logo' ? agency.logo_url : agency.cover_url;
                  return (
                    <label key={kind} className="block cursor-pointer">
                      <span className="mb-2 block text-sm font-medium text-gray-700">{kind === 'logo' ? 'Logo' : 'Image de couverture'}</span>
                      <span className="flex h-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-secondary-500">
                        {uploading === kind ? <LoadingSpinner size="sm" /> : url ? (
                          <img src={url} alt="" className="h-full w-full object-contain" />
                        ) : <span className="text-sm text-gray-400">JPEG, PNG ou WebP · 2 Mo max</span>}
                      </span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onUpload(kind, e.target.files?.[0])} />
                    </label>
                  );
                })}
                {uploadError && <p role="alert" className="text-sm text-danger-600 sm:col-span-2">{uploadError}</p>}
              </div>
            </Panel>
          )}

          <Panel title="Informations">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Input label="Nom de l’agence *" value={form.name} onChange={set('name')} required maxLength={120} />
              <Input label="Accroche" value={form.tagline ?? ''} onChange={set('tagline')} maxLength={140} placeholder="Votre partenaire immobilier aux Gonaïves" />
              <Input label="Téléphone *" type="tel" value={form.phone} onChange={set('phone')} required maxLength={30} />
              <Input label="WhatsApp" type="tel" value={form.whatsapp ?? ''} onChange={set('whatsapp')} maxLength={30} />
              <Input label="E-mail" type="email" value={form.email ?? ''} onChange={set('email')} maxLength={254} />
              <Input label="Site web" type="url" value={form.website ?? ''} onChange={set('website')} placeholder="https://" maxLength={200} />
              <Select label="Ville" value={form.city_id ?? ''} onChange={set('city_id')} placeholder="Sélectionnez"
                options={(cities || []).map((c) => ({ value: c.id, label: c.name }))} />
              <Input label="Adresse" value={form.address ?? ''} onChange={set('address')} maxLength={200} />
              <Input label="N° de licence / patente" value={form.license_number ?? ''} onChange={set('license_number')} maxLength={60} />
              {customPage && (
                <Input label="Couleur de la page (Enterprise)" type="color" value={form.brand_color || '#1D3E91'} onChange={set('brand_color')} />
              )}
              <div className="sm:col-span-2"><TextArea label="Présentation" rows={5} value={form.description ?? ''} onChange={set('description')} maxLength={4000} /></div>
              <div className="sm:col-span-2"><TextArea label="Présentation de l’équipe" rows={3} value={form.team_intro ?? ''} onChange={set('team_intro')} maxLength={1000} /></div>
            </div>
          </Panel>

          {error && <p role="alert" className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{errorMessage(error)}</p>}
          {saved && <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700">{agency ? 'Modifications enregistrées.' : 'Agence créée. Notre équipe va la vérifier.'}</p>}
          <div className="flex justify-end">
            <Button type="submit" icon={<Save className="h-4 w-4" />} isLoading={create.isPending || update.isPending}>
              {agency ? 'Enregistrer' : 'Créer mon agence'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
