import { useState } from 'react';
import { Save, PlayCircle } from 'lucide-react';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { DataTable } from '@/components/billing/BillingUI';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminMutation, useAdminQuery } from '@/hooks/useAdminMarketplace';
import { adminMarketplaceService } from '@/services/admin-marketplace.service';
import { errorMessage } from '@/lib/monetization';
import { formatRelativeTime } from '@/lib/utils';
import type { SiteSettings } from '@/types';

/** Secrets never live in site_settings; this key is legacy and is hidden from the UI. */
const HIDDEN_KEYS = ['google_maps_api_key'];

function SettingRow({ setting, editable }: { setting: SiteSettings; editable: boolean }) {
  const initial = JSON.stringify(setting.value);
  const [value, setValue] = useState(initial);
  const save = useAdminMutation((v: unknown) => adminMarketplaceService.updateSetting(setting.key, v));
  let parsed: unknown;
  let valid = true;
  try { parsed = JSON.parse(value); } catch { valid = false; }
  const isBool = typeof setting.value === 'boolean';

  return (
    <tr>
      <td className="px-5 py-3"><p className="font-mono text-xs text-primary-900">{setting.key}</p><p className="text-xs text-gray-500">{setting.description}</p></td>
      <td className="px-5 py-3">
        {isBool ? (
          <select value={value} disabled={!editable} onChange={(e) => setValue(e.target.value)} aria-label={setting.key}
            className="select-chevron rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            <option value="true">Oui</option><option value="false">Non</option>
          </select>
        ) : (
          <input value={value} disabled={!editable} onChange={(e) => setValue(e.target.value)} aria-label={setting.key}
            className={`w-56 rounded-lg border px-2 py-1.5 font-mono text-xs ${valid ? 'border-gray-300' : 'border-danger-500'}`} />
        )}
        {save.isError && <p className="mt-1 text-xs text-danger-600">{errorMessage(save.error)}</p>}
      </td>
      <td className="px-5 py-3">
        {editable && value !== initial && (
          <Button size="sm" icon={<Save className="h-4 w-4" />} disabled={!valid} isLoading={save.isPending} onClick={() => save.mutate(parsed)}>Enregistrer</Button>
        )}
      </td>
    </tr>
  );
}

export function AdminSettings() {
  const { profile } = useAuth();
  const isSuper = profile?.role === 'super_admin';
  const [entity, setEntity] = useState('');
  const settings = useAdminQuery(['settings'], () => adminMarketplaceService.getSettings());
  const logs = useAdminQuery(['audit', entity], () => adminMarketplaceService.getAuditLogs(entity));
  const maintenance = useAdminMutation(() => adminMarketplaceService.runMaintenance());

  return (
    <div>
      <PageHeader title="Paramètres globaux" subtitle={isSuper ? 'Modifications réservées au super administrateur et journalisées.' : 'Lecture seule : seul un super administrateur peut modifier ces paramètres.'}
        actions={<Button variant="outline" icon={<PlayCircle className="h-4 w-4" />} isLoading={maintenance.isPending} onClick={() => maintenance.mutate(undefined)}>Lancer les expirations</Button>} />
      {maintenance.isSuccess && (
        <p role="status" className="mb-4 rounded-lg bg-success-50 p-3 font-mono text-xs text-success-700">{JSON.stringify(maintenance.data)}</p>
      )}
      <Panel title="Paramètres">
        {settings.isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable headers={['Clé', 'Valeur', '']}>
            {(settings.data || []).filter((s) => !HIDDEN_KEYS.includes(s.key)).map((s) => (
              <SettingRow key={`${s.key}-${s.updated_at}`} setting={s} editable={isSuper} />
            ))}
          </DataTable>
        )}
      </Panel>
      <p className="mt-3 text-xs text-gray-500">
        « payments_simulation_enabled » doit rester à <strong>Non</strong> en production : le mode simulé est en plus bloqué par l’Edge Function lorsque APP_ENV=production.
      </p>

      <Panel title="Journal d’audit" className="mt-6" action={
        <div className="w-48"><Select aria-label="Filtrer" value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="Toutes les entités"
          options={['payments', 'subscriptions', 'subscription_plans', 'promotion_offers', 'agencies', 'profiles', 'properties', 'advertising_campaigns', 'site_settings', 'service_requests', 'listing_promotions']
            .map((v) => ({ value: v, label: v }))} /></div>
      }>
        {logs.isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable headers={['Quand', 'Acteur', 'Action', 'Entité', 'Changements']}
            empty={(logs.data || []).length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucune entrée.</p> : null}>
            {(logs.data || []).map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-5 py-3 text-xs">{formatRelativeTime(log.created_at)}</td>
                <td className="px-5 py-3 text-xs">{log.actor_role ?? 'système'}<br /><span className="font-mono text-gray-400">{log.actor_id?.slice(0, 8) ?? '—'}</span></td>
                <td className="px-5 py-3 text-xs font-semibold">{log.action}</td>
                <td className="px-5 py-3 text-xs">{log.entity_type}<br /><span className="font-mono text-gray-400">{log.entity_id?.slice(0, 12)}</span></td>
                <td className="max-w-md px-5 py-3">
                  <code className="block max-h-24 overflow-auto whitespace-pre-wrap break-all text-[11px] text-gray-600">
                    {log.note ? `Note : ${log.note}\n` : ''}{log.new_values ? JSON.stringify(log.new_values) : ''}
                  </code>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
