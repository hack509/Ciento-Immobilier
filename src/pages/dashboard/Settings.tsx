import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader, Panel } from '@/components/dashboard/DashboardUI';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import { getRoleLabel } from '@/lib/utils';

const MIN_PASSWORD_LENGTH = 8;

function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const mismatch = confirmation.length > 0 && password !== confirmation;
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit = password.length >= MIN_PASSWORD_LENGTH && password === confirmation && !isSaving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    setStatus(null);
    try {
      await authService.updatePassword(password);
      setPassword('');
      setConfirmation('');
      setStatus({ type: 'success', message: 'Votre mot de passe a été modifié.' });
    } catch (err: unknown) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Impossible de modifier le mot de passe.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5">
      {status && (
        <p
          role={status.type === 'error' ? 'alert' : 'status'}
          className={status.type === 'success'
            ? 'rounded-xl bg-success-50 p-3 text-sm text-success-700'
            : 'rounded-xl bg-danger-50 p-3 text-sm text-danger-600'}
        >
          {status.message}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="new-password"
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="h-4 w-4" />}
          error={tooShort ? `${MIN_PASSWORD_LENGTH} caractères minimum` : undefined}
        />
        <Input
          id="confirm-password"
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          icon={<Lock className="h-4 w-4" />}
          error={mismatch ? 'Les mots de passe ne correspondent pas' : undefined}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit} isLoading={isSaving}>
          Mettre à jour le mot de passe
        </Button>
      </div>
    </form>
  );
}

export function Settings() {
  const { profile } = useAuth();

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Sécurité et informations de votre compte." />

      <div className="space-y-6">
        <Panel title="Compte">
          <dl className="divide-y divide-gray-100">
            {[
              { icon: Mail, label: 'Adresse email', value: profile?.email },
              { icon: ShieldCheck, label: 'Type de compte', value: profile ? getRoleLabel(profile.role) : '' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-4">
                <Icon className="h-4.5 w-4.5 text-primary-400" />
                <dt className="flex-1 text-sm text-gray-600">{label}</dt>
                <dd className="text-sm font-semibold text-primary-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Mot de passe">
          <PasswordForm />
        </Panel>

        <Panel title="Supprimer mon compte">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              La suppression efface vos annonces, messages et favoris de façon définitive.
              Notre équipe la traite sur demande pour vérifier votre identité.
            </p>
            <Link to="/contact" className="shrink-0">
              <Button variant="outline" icon={<LifeBuoy className="h-4 w-4" />}>Contacter le support</Button>
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
