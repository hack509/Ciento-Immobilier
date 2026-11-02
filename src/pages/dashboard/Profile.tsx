import { useState } from 'react';
import { User, Phone, MapPin, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import { getRoleLabel } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/DashboardUI';

export function Profile() {
  const { profile, refreshProfile } = useAuth();
  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || '',
    bio: profile?.bio || '',
    address: profile?.address || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await authService.updateProfile(profile.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        bio: formData.bio,
        address: formData.address,
      });
      await refreshProfile();
      setSuccess('Profil mis à jour avec succès');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Mon profil" subtitle="Ces informations aident les acheteurs et propriétaires à vous identifier." />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        {success && (
          <div className="mb-4 p-3 bg-success-50 text-success-600 text-sm rounded-lg">{success}</div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-danger-50 text-danger-600 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-20 h-20 bg-primary-800 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{profile?.first_name} {profile?.last_name}</div>
              <div className="text-sm text-gray-500">{profile?.email}</div>
              <span className="mt-2 inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">{profile ? getRoleLabel(profile.role) : ''}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Prénom"
              value={formData.first_name}
              onChange={handleChange('first_name')}
              icon={<User className="w-4 h-4" />}
              required
            />
            <Input
              label="Nom"
              value={formData.last_name}
              onChange={handleChange('last_name')}
              required
            />
          </div>
          <Input
            label="Téléphone"
            type="tel"
            value={formData.phone}
            onChange={handleChange('phone')}
            icon={<Phone className="w-4 h-4" />}
            placeholder="+509 xxx-xxxx"
          />
          <Input
            label="Adresse"
            value={formData.address}
            onChange={handleChange('address')}
            icon={<MapPin className="w-4 h-4" />}
            placeholder="Votre adresse"
          />
          <TextArea
            label="Bio"
            value={formData.bio}
            onChange={handleChange('bio')}
            placeholder="Parlez-nous de vous..."
            rows={4}
          />
          <div className="flex justify-end">
            <Button type="submit" isLoading={isLoading} icon={<Save className="w-4 h-4" />}>
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
