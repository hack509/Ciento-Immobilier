import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
  usePropertyAmenities,
} from '@/hooks/useProperties';
import { useUploadPropertyImage, useDeletePropertyImage } from '@/hooks/usePropertyMutations';
import { propertiesService } from '@/services/properties.service';
import { storageService } from '@/services/storage.service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PROPERTY_TYPES, LISTING_TYPES } from '@/lib/constants';
import type { Property, PropertyImage, Amenity } from '@/types';

const propertySchema = z.object({
  title: z.string().min(5, 'Le titre doit contenir au moins 5 caractères'),
  description: z.string().min(20, 'La description doit contenir au moins 20 caractères'),
  property_type: z.string().min(1, 'Sélectionnez un type de bien'),
  listing_type: z.string().min(1, 'Sélectionnez un type d\'annonce'),
  category_id: z.string().min(1, 'Sélectionnez une catégorie'),
  city_id: z.string().min(1, 'Sélectionnez une ville'),
  neighborhood_id: z.string().optional(),
  price: z.coerce.number().min(1, 'Le prix est requis'),
  price_currency: z.string().default('HTG'),
  price_negotiable: z.boolean().default(false),
  bedrooms: z.coerce.number().min(0).default(0),
  bathrooms: z.coerce.number().min(0).default(0),
  half_baths: z.coerce.number().min(0).default(0),
  total_rooms: z.coerce.number().min(0).default(0),
  land_area: z.coerce.number().optional(),
  building_area: z.coerce.number().optional(),
  floors: z.coerce.number().min(1).default(1),
  year_built: z.coerce.number().optional(),
  address: z.string().optional(),
  is_published: z.boolean().default(false),
});

type PropertyFormData = z.infer<typeof propertySchema>;

export function PropertyForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const uploadImage = useUploadPropertyImage();
  const deleteImage = useDeletePropertyImage();
  const { data: amenities } = usePropertyAmenities();

  const { data: existingProperty, isLoading: isLoadingProperty } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesService.getById(id!),
    enabled: isEdit,
  });

  const { data: existingImages } = useQuery({
    queryKey: ['property-images', id],
    queryFn: () => storageService.getPropertyImages(id!),
    enabled: isEdit,
  });

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [images, setImages] = useState<PropertyImage[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormData>({
    // NOTE: zodResolver type inference has a known compatibility issue with Zod v4's z.coerce.number()
    // The inferred type shows price:unknown instead of price:number
    resolver: zodResolver(propertySchema) as unknown as Resolver<PropertyFormData>,

    defaultValues: {
      price_currency: 'HTG',
      price_negotiable: false,
      bedrooms: 0,
      bathrooms: 0,
      half_baths: 0,
      total_rooms: 0,
      floors: 1,
      is_published: false,
    },
  });

  const isPublished = watch('is_published');
  const isNegotiable = watch('price_negotiable');

  useEffect(() => {
    if (existingProperty) {
      reset({
        title: existingProperty.title,
        description: existingProperty.description,
        property_type: existingProperty.property_type,
        listing_type: existingProperty.listing_type,
        category_id: existingProperty.category_id,
        city_id: existingProperty.city_id,
        neighborhood_id: existingProperty.neighborhood_id || '',
        price: existingProperty.price,
        price_currency: existingProperty.price_currency,
        price_negotiable: existingProperty.price_negotiable,
        bedrooms: existingProperty.bedrooms,
        bathrooms: existingProperty.bathrooms,
        half_baths: existingProperty.half_baths,
        total_rooms: existingProperty.total_rooms,
        land_area: existingProperty.land_area,
        building_area: existingProperty.building_area,
        floors: existingProperty.floors,
        year_built: existingProperty.year_built,
        address: existingProperty.address || '',
        is_published: existingProperty.is_published,
      });
      setSelectedAmenities(
        existingProperty.amenities?.map((a: Amenity) => a.id) || []
      );
    }
  }, [existingProperty, reset]);

  useEffect(() => {
    if (existingImages) {
      setImages(existingImages as PropertyImage[]);
    }
  }, [existingImages]);

  const onSubmit = async (data: PropertyFormData) => {
    try {
      const payload = {
        ...data,
        owner_id: profile?.id,
        neighborhood_id: data.neighborhood_id || null,
        address: data.address || null,
        land_area: data.land_area || null,
        building_area: data.building_area || null,
        year_built: data.year_built || null,
      } as unknown as Partial<Property>;

      let propertyId: string;

      if (isEdit && id) {
        const updated = await updateProperty.mutateAsync({ id, data: payload });
        propertyId = updated.id;
      } else {
        const created = await createProperty.mutateAsync(payload);
        propertyId = created.id;
      }

      if (selectedAmenities.length > 0) {
        await propertiesService.setPropertyAmenities(propertyId, selectedAmenities);
      }

      queryClient.invalidateQueries({ queryKey: ['properties'] });
      navigate('/dashboard/annonces');
    } catch (err) {
      console.error('Property save error:', err);
    }
  };

  const handleImageUpload = async (files: File[]) => {
    if (!id && !isEdit) return;
    for (const file of files) {
      await uploadImage.mutateAsync({
        propertyId: id!,
        file,
        isPrimary: images.length === 0,
      });
    }
    const updatedImages = await storageService.getPropertyImages(id!);
    setImages(updatedImages as PropertyImage[]);
  };

  const handleImageRemove = async (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;
    await deleteImage.mutateAsync({ imageId, storagePath: image.storage_path });
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const handleSetPrimary = async (imageId: string) => {
    const updated = images.map((img) => ({
      id: img.id,
      sort_order: img.sort_order,
      is_primary: img.id === imageId,
    }));
    await storageService.reorderImages(updated);
    setImages((prev) =>
      prev.map((img) => ({ ...img, is_primary: img.id === imageId }))
    );
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteProperty.mutateAsync(id);
    navigate('/dashboard/annonces');
  };

  const toggleAmenity = (amenityId: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenityId)
        ? prev.filter((a) => a !== amenityId)
        : [...prev, amenityId]
    );
  };

  if (isEdit && isLoadingProperty) {
    return <LoadingSpinner size="lg" text="Chargement de l'annonce..." className="py-20" />;
  }

  const amenitiesByCategory = amenities?.reduce<Record<string, Amenity[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] || []).push(a);
    return acc;
  }, {}) || {};

  const categoryLabels: Record<string, string> = {
    infrastructure: 'Infrastructure',
    securite: 'Sécurité',
    confort: 'Confort',
    exterieur: 'Extérieur',
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard/annonces')} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {isEdit ? 'Mettez à jour les informations de votre annonce' : 'Remplissez les détails pour publier votre annonce'}
            </p>
          </div>
        </div>
        {isEdit && (
          <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => setShowDeleteModal(true)}>
            Supprimer
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h2>
          <div className="space-y-4">
            <Input
              label="Titre de l'annonce"
              placeholder="Ex: Belle maison moderne au centre-ville"
              error={errors.title?.message}
              {...register('title')}
            />
            <TextArea
              label="Description"
              placeholder="Décrivez votre bien en détail..."
              rows={5}
              error={errors.description?.message}
              {...register('description')}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Type de bien"
                options={PROPERTY_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                placeholder="Sélectionnez..."
                error={errors.property_type?.message}
                {...register('property_type')}
              />
              <Select
                label="Type d'annonce"
                options={LISTING_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                placeholder="Sélectionnez..."
                error={errors.listing_type?.message}
                {...register('listing_type')}
              />
            </div>
            <Input
              label="Adresse"
              placeholder="Adresse ou quartier"
              {...register('address')}
            />
          </div>
        </section>

        {/* Location */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Localisation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ville"
              placeholder="Les Gonaïves"
              error={errors.city_id?.message}
              {...register('city_id')}
            />
            <Input
              label="Quartier"
              placeholder="Centre-ville"
              {...register('neighborhood_id')}
            />
            <Input
              label="Catégorie"
              placeholder="ID catégorie"
              error={errors.category_id?.message}
              {...register('category_id')}
            />
          </div>
        </section>

        {/* Price */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Prix</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Prix"
                type="number"
                placeholder="0"
                error={errors.price?.message}
                {...register('price')}
              />
              <Select
                label="Devise"
                options={[
                  { value: 'HTG', label: 'HTG (Gourde)' },
                  { value: 'USD', label: 'USD (Dollar)' },
                ]}
                {...register('price_currency')}
              />
            </div>
            <Switch
              checked={isNegotiable}
              onChange={(val) => setValue('price_negotiable', val)}
              label="Prix négociable"
              description="Indiquez si le prix est discutable"
            />
          </div>
        </section>

        {/* Details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Détails du bien</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input label="Chambres" type="number" {...register('bedrooms')} />
            <Input label="Salles de bain" type="number" {...register('bathrooms')} />
            <Input label="Demi-bains" type="number" {...register('half_baths')} />
            <Input label="Total pièces" type="number" {...register('total_rooms')} />
            <Input label="Étages" type="number" {...register('floors')} />
            <Input label="Année construction" type="number" placeholder="Ex: 2020" {...register('year_built')} />
            <Input label="Surface terrain (m²)" type="number" {...register('land_area')} />
            <Input label="Surface bâtiment (m²)" type="number" {...register('building_area')} />
          </div>
        </section>

        {/* Images */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
          {isEdit ? (
            <ImageUpload
              images={images}
              onUpload={handleImageUpload}
              onRemove={handleImageRemove}
              onSetPrimary={handleSetPrimary}
              isLoading={uploadImage.isPending}
            />
          ) : (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
              Enregistrez l'annonce puis ajoutez des photos depuis la page de modification.
            </p>
          )}
        </section>

        {/* Amenities */}
        {amenities && Object.keys(amenitiesByCategory).length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Équipements</h2>
            <div className="space-y-4">
              {Object.entries(amenitiesByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    {categoryLabels[category] || category}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((amenity) => (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedAmenities.includes(amenity.id)
                            ? 'bg-secondary-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {amenity.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Publish */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Publication</h2>
          <Switch
            checked={isPublished}
            onChange={(val) => setValue('is_published', val)}
            label="Publier l'annonce"
            description={isPublished ? 'Votre annonce est visible par tous' : 'L\'annonce reste en brouillon'}
          />
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button type="button" variant="ghost" onClick={() => navigate('/dashboard/annonces')}>
            Annuler
          </Button>
          <Button type="submit" icon={<Save className="w-4 h-4" />} isLoading={isSubmitting || createProperty.isPending || updateProperty.isPending}>
            {isEdit ? 'Enregistrer les modifications' : 'Créer l\'annonce'}
          </Button>
        </div>
      </form>

      {/* Delete Confirmation */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Supprimer l'annonce">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est irréversible.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
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
