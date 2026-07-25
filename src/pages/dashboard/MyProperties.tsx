import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Edit, Trash2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { useOwnProperties, useDeleteProperty } from '@/hooks/useProperties';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice, getStatusColor } from '@/lib/utils';
import { getListingTypeLabel, getPropertyTypeLabel } from '@/lib/utils';

export function MyProperties() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteProperty = useDeleteProperty();

  const { data, isLoading } = useOwnProperties(user?.id, page);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteProperty.mutateAsync(deleteId);
    setDeleteId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes annonces</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data ? `${data.count} annonce${data.count > 1 ? 's' : ''}` : 'Gérez vos annonces immobilières'}
          </p>
        </div>
        <Link to="/dashboard/annonces/nouvelle">
          <Button icon={<Plus className="w-4 h-4" />}>
            Nouvelle annonce
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" text="Chargement..." className="py-20" />
      ) : data?.data && data.data.length > 0 ? (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Annonce</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Prix</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Vues</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((property) => (
                    <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {property.images?.[0] ? (
                            <img src={property.images[0].url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                              <Building2 className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 line-clamp-1">{property.title}</div>
                            <div className="text-xs text-gray-500">{property.city?.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-600 text-xs">{getPropertyTypeLabel(property.property_type)}</div>
                        <div className="text-gray-400 text-xs">{getListingTypeLabel(property.listing_type)}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatPrice(property.price)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusColor(property.status)} size="sm">
                          {property.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{property.views_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {property.is_published && (
                            <Link
                              to={`/annonces/${property.city?.slug || 'inconnu'}/${property.slug}`}
                              target="_blank"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-600 hover:bg-secondary-50"
                              title="Voir"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          )}
                          <Link
                            to={`/dashboard/annonces/${property.id}/modifier`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-600 hover:bg-secondary-50"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setDeleteId(property.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-danger-500 hover:bg-danger-50"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            currentPage={page}
            totalPages={data.total_pages}
            onPageChange={setPage}
            className="mt-6"
          />
        </>
      ) : (
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title="Aucune annonce"
          description="Vous n'avez pas encore publié d'annonce. Commencez maintenant !"
          action={
            <Link to="/dashboard/annonces/nouvelle">
              <Button icon={<Plus className="w-4 h-4" />}>
                Publier une annonce
              </Button>
            </Link>
          }
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer l'annonce">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est irréversible.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteProperty.isPending}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
