import { Globe, Shield, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Settings() {
  const { profile } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Paramètres</h1>
      <p className="text-gray-500 text-sm mb-6">Configurez vos préférences</p>

      <div className="space-y-6">
        {/* Language */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-secondary-50 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-secondary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Langue</h2>
              <p className="text-sm text-gray-500">Choisissez votre langue préférée</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg bg-secondary-500 text-white text-sm font-medium">
              Français
            </button>
            <button className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50">
              English
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-warning-50 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Sécurité</h2>
              <p className="text-sm text-gray-500">Gérez votre mot de passe et la sécurité de votre compte</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Email</span>
              <span className="text-sm text-gray-900">{profile?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Mot de passe</span>
              <button className="text-sm text-secondary-600 hover:text-secondary-700 font-medium">
                Changer le mot de passe
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-success-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-500">Configurez vos préférences de notification</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Nouveaux messages', defaultChecked: true },
              { label: 'Rendez-vous', defaultChecked: true },
              { label: 'Mises à jour des annonces', defaultChecked: false },
              { label: 'Newsletter', defaultChecked: false },
            ].map((item) => (
              <label key={item.label} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">{item.label}</span>
                <input
                  type="checkbox"
                  defaultChecked={item.defaultChecked}
                  className="rounded border-gray-300 text-secondary-600 focus:ring-secondary-500"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border border-danger-200 p-6">
          <h2 className="font-semibold text-danger-600 mb-2">Zone dangereuse</h2>
          <p className="text-sm text-gray-500 mb-4">Ces actions sont irréversibles.</p>
          <button className="px-4 py-2 rounded-lg border border-danger-300 text-danger-600 text-sm font-medium hover:bg-danger-50 transition-colors">
            Supprimer mon compte
          </button>
        </div>
      </div>
    </div>
  );
}
