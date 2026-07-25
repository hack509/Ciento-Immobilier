import { Star, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAgents } from '@/hooks/useAgents';

export function Agents() {
  const { data: agents, isLoading } = useAgents();

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agents immobiliers</h1>
          <p className="text-gray-500">Nos agents certifiés sont à votre service</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <LoadingSpinner size="lg" text="Chargement des agents..." className="py-32" />
        ) : agents && agents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {agents.map((agent) => (
              <Card key={agent.id} hover className="text-center p-6">
                {agent.profile?.avatar_url ? (
                  <img
                    src={agent.profile.avatar_url}
                    alt={`${agent.profile.first_name} ${agent.profile.last_name}`}
                    className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-secondary-100 rounded-full mx-auto mb-3 flex items-center justify-center text-secondary-700 font-medium text-xl">
                    {agent.profile?.first_name?.[0]}{agent.profile?.last_name?.[0]}
                  </div>
                )}
                <h3 className="font-semibold text-gray-900">
                  {agent.profile?.first_name} {agent.profile?.last_name}
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  {agent.agency?.name || 'Agent indépendant'}
                </p>
                {agent.is_verified && (
                  <Badge variant="success" size="sm" className="mb-2">Vérifié</Badge>
                )}
                <div className="flex items-center justify-center gap-4 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {agent.properties_count}
                  </span>
                  {agent.rating_avg > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-warning-500 fill-warning-500" />
                      {agent.rating_avg.toFixed(1)}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title="Aucun agent trouvé"
            description="Aucun agent n'est encore inscrit sur la plateforme."
          />
        )}
      </div>
    </div>
  );
}
