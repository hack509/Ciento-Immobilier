import { useState } from 'react';
import { Plus, Pencil, Trash2, ImagePlus } from 'lucide-react';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { DataTable } from '@/components/billing/BillingUI';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAdminMutation, useAdminQuery } from '@/hooks/useAdminMarketplace';
import { adminMarketplaceService } from '@/services/admin-marketplace.service';
import { AD_PLACEMENT_LABELS, AD_SECTOR_LABELS, errorMessage } from '@/lib/monetization';
import { formatDate } from '@/lib/utils';
import type { AdCampaign, AdPlacement, AdSector } from '@/types/marketplace';

const toLocalInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const fromLocalInput = (value: string) => new Date(value).toISOString();

function isLive(c: AdCampaign) {
  const now = Date.now();
  return c.is_active && new Date(c.starts_at).getTime() <= now && new Date(c.ends_at).getTime() > now;
}

export function AdminAds() {
  const { data: campaigns, isLoading } = useAdminQuery(['campaigns'], () => adminMarketplaceService.getCampaigns());
  const save = useAdminMutation((c: Partial<AdCampaign>) => adminMarketplaceService.saveCampaign(c));
  const remove = useAdminMutation((id: string) => adminMarketplaceService.deleteCampaign(id));
  const [draft, setDraft] = useState<Partial<AdCampaign> | null>(null);
  const [toDelete, setToDelete] = useState<AdCampaign | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof AdCampaign>(key: K, value: AdCampaign[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const newDraft = (): Partial<AdCampaign> => {
    const start = new Date();
    const end = new Date(Date.now() + 30 * 86_400_000);
    return { advertiser_name: '', advertiser_sector: 'construction', title: '', image_url: '', target_url: 'https://',
      placement: 'home_banner', starts_at: start.toISOString(), ends_at: end.toISOString(), is_active: false, priority: 0, currency: 'HTG' };
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try { set('image_url', await adminMarketplaceService.uploadAdBanner(file)); }
    catch (err) { setUploadError(errorMessage(err)); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <PageHeader title="Publicité professionnelle" subtitle="Campagnes des entreprises partenaires : construction, architectes, matériaux, banques, assurances…"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setDraft(newDraft())}>Nouvelle campagne</Button>} />
      <Panel>
        {isLoading ? <LoadingSpinner className="py-16" /> : (
          <DataTable headers={['Campagne', 'Emplacement', 'Période', 'Impressions', 'Clics', 'CTR', 'État', '']}
            empty={(campaigns || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune campagne.</p> : null}>
            {(campaigns || []).map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-3"><p className="font-medium text-primary-900">{c.title}</p><p className="text-xs text-gray-500">{c.advertiser_name} · {AD_SECTOR_LABELS[c.advertiser_sector]}</p></td>
                <td className="px-5 py-3 text-xs">{AD_PLACEMENT_LABELS[c.placement]}</td>
                <td className="whitespace-nowrap px-5 py-3 text-xs">{formatDate(c.starts_at)}<br />→ {formatDate(c.ends_at)}</td>
                <td className="px-5 py-3 tabular-nums">{c.impressions_count}</td>
                <td className="px-5 py-3 tabular-nums">{c.clicks_count}</td>
                <td className="px-5 py-3 tabular-nums">{c.impressions_count > 0 ? `${((c.clicks_count / c.impressions_count) * 100).toFixed(1)} %` : '—'}</td>
                <td className="px-5 py-3">{isLive(c) ? <Badge variant="success">En ligne</Badge> : c.is_active ? <Badge variant="warning">Programmée / terminée</Badge> : <Badge>Désactivée</Badge>}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label="Modifier" onClick={() => setDraft(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Supprimer" onClick={() => setToDelete(c)}><Trash2 className="h-4 w-4 text-danger-600" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <Modal isOpen={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Modifier la campagne' : 'Nouvelle campagne'} className="max-w-2xl">
        {draft && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(draft, { onSuccess: () => setDraft(null) }); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Annonceur" value={draft.advertiser_name} onChange={(e) => set('advertiser_name', e.target.value)} required maxLength={120} />
              <Select label="Secteur" value={draft.advertiser_sector} onChange={(e) => set('advertiser_sector', e.target.value as AdSector)}
                options={Object.entries(AD_SECTOR_LABELS).map(([value, label]) => ({ value, label }))} />
              <Input label="Contact annonceur" value={draft.advertiser_contact ?? ''} onChange={(e) => set('advertiser_contact', e.target.value)} />
              <Input label="Titre" value={draft.title} onChange={(e) => set('title', e.target.value)} required maxLength={120} />
              <Input label="URL de destination (https)" type="url" pattern="https://.*" value={draft.target_url} onChange={(e) => set('target_url', e.target.value)} required />
              <Select label="Emplacement" value={draft.placement} onChange={(e) => set('placement', e.target.value as AdPlacement)}
                options={Object.entries(AD_PLACEMENT_LABELS).map(([value, label]) => ({ value, label }))} />
              <Input label="Début" type="datetime-local" value={toLocalInput(draft.starts_at)} onChange={(e) => set('starts_at', fromLocalInput(e.target.value))} required />
              <Input label="Fin" type="datetime-local" value={toLocalInput(draft.ends_at)} onChange={(e) => set('ends_at', fromLocalInput(e.target.value))} required />
              <Input label="Priorité" type="number" value={draft.priority} onChange={(e) => set('priority', Number(e.target.value))} />
              <Input label="Budget (optionnel)" type="number" min={0} value={draft.budget_amount ?? ''} onChange={(e) => set('budget_amount', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Bannière</span>
              <label className="flex min-h-[7rem] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-secondary-500">
                {uploading ? <LoadingSpinner size="sm" /> : draft.image_url ? <img src={draft.image_url} alt="" className="max-h-40 w-full object-contain" /> :
                  <span className="flex items-center gap-2 text-sm text-gray-400"><ImagePlus className="h-5 w-5" />JPEG, PNG ou WebP · 2 Mo</span>}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {uploadError && <p className="mt-1 text-xs text-danger-600">{uploadError}</p>}
            </div>
            <Input label="Texte alternatif" value={draft.alt_text ?? ''} onChange={(e) => set('alt_text', e.target.value)} />
            <Switch label="Campagne activée" checked={!!draft.is_active} onChange={(v) => set('is_active', v)} />
            {save.isError && <p role="alert" className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{errorMessage(save.error)}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Annuler</Button>
              <Button type="submit" isLoading={save.isPending} disabled={!draft.image_url}>Enregistrer</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!toDelete} title="Supprimer la campagne ?" description="Les statistiques d’impressions et de clics seront également supprimées."
        tone="danger" confirmLabel="Supprimer" isLoading={remove.isPending} error={remove.isError ? errorMessage(remove.error) : null}
        onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })} />
    </div>
  );
}
