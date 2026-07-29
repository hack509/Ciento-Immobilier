import { Building2, Heart, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const statStyles = {
  primary: { bg: 'bg-primary-50', text: 'text-primary-600' },
  success: { bg: 'bg-success-50', text: 'text-success-600' },
  secondary: { bg: 'bg-secondary-50', text: 'text-secondary-600' },
} as const;

export function DashboardOverview() {
  const { profile } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Bonjour, {profile?.first_name}
      </h1>
      <p className="text-gray-500 mb-8">Voici un aperçu de votre activité</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Building2, label: 'Annonces actives', value: '0', key: 'primary' as const },
          { icon: Heart, label: 'Favoris', value: '0', key: 'success' as const },
          { icon: MessageSquare, label: 'Messages non lus', value: '0', key: 'secondary' as const },
        ].map((stat) => {
          const Icon = stat.icon;
          const styles = statStyles[stat.key];
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${styles.bg}`}>
                  <Icon className={`w-5 h-5 ${styles.text}`} />
                </div>
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Activité récente</h2>
        <p className="text-gray-500 text-sm">Aucune activité récente. Commencez par publier une annonce ou explorer les biens disponibles.</p>
      </div>
    </div>
  );
}
