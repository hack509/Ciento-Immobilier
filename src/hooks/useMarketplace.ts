import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { marketplaceService, type AgencyInput } from '@/services/marketplace.service';
import { catalogService, type ServiceRequestInput } from '@/services/catalog.service';
import type { AdPlacement, AgencyMember, AgencyMemberRole, InquiryStatus, MyAgency } from '@/types/marketplace';

export function useMyAgencies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-agencies', user?.id],
    queryFn: () => marketplaceService.getMyAgencies(user!.id),
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

/**
 * Personal space vs. agency space for dashboard pages, kept in the URL
 * (?espace=agence) so links and reloads keep the context.
 */
export function useAccountScope() {
  const { data: agencies = [], isLoading } = useMyAgencies();
  const [params, setParams] = useSearchParams();
  const wantsAgency = params.get('espace') === 'agence';
  const membership: MyAgency | null = agencies[0] ?? null;
  const isAgencyScope = wantsAgency && !!membership;

  const setScope = useCallback((scope: 'personal' | 'agency') => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (scope === 'agency') next.set('espace', 'agence');
      else next.delete('espace');
      return next;
    }, { replace: true });
  }, [setParams]);

  return useMemo(() => ({
    isLoading,
    membership,
    agencyId: isAgencyScope ? membership!.agency.id : null,
    isAgencyScope,
    setScope,
  }), [isLoading, membership, isAgencyScope, setScope]);
}

export function useCreateAgency() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgencyInput) => marketplaceService.createAgency(user!.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-agencies'] }),
  });
}

export function useUpdateAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AgencyInput> }) => marketplaceService.updateAgency(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-agencies'] });
      queryClient.invalidateQueries({ queryKey: ['agency'] });
    },
  });
}

export function useAgencyMembers(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['agency-members', agencyId],
    queryFn: () => marketplaceService.getAgencyMembers(agencyId!),
    enabled: !!agencyId,
  });
}

export function useAgencyMemberMutations(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['agency-members', agencyId] });
  return {
    add: useMutation({
      mutationFn: ({ email, role, title }: { email: string; role: AgencyMemberRole; title?: string }) =>
        marketplaceService.addAgencyMember(agencyId!, email, role, title),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: Partial<AgencyMember> }) =>
        marketplaceService.updateAgencyMember(id, changes),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => marketplaceService.removeAgencyMember(id),
      onSuccess: invalidate,
    }),
  };
}

export function useAgencyPortfolio(agencyId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['agency-portfolio', agencyId, status],
    queryFn: () => marketplaceService.getAgencyPortfolio(agencyId!, status),
    enabled: !!agencyId,
  });
}

export function usePublicAgencies() {
  return useQuery({
    queryKey: ['agency', 'public-list'],
    queryFn: () => marketplaceService.getPublicAgencies(),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePublicAgency(slug: string | undefined) {
  return useQuery({
    queryKey: ['agency', 'public', slug],
    queryFn: () => marketplaceService.getPublicAgency(slug!),
    enabled: !!slug,
  });
}

export function usePublicAgencyDetails(agencyId: string | undefined) {
  const team = useQuery({
    queryKey: ['agency', 'team', agencyId],
    queryFn: () => marketplaceService.getPublicTeam(agencyId!),
    enabled: !!agencyId,
  });
  const listings = useQuery({
    queryKey: ['agency', 'listings', agencyId],
    queryFn: () => marketplaceService.getAgencyPublicListings(agencyId!),
    enabled: !!agencyId,
  });
  return { team, listings };
}

export function useSubmitInquiry() {
  return useMutation({ mutationFn: marketplaceService.submitInquiry.bind(marketplaceService) });
}

export function useInquiries(agencyId: string | null, status: InquiryStatus | '') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inquiries', user?.id, agencyId, status],
    queryFn: () => marketplaceService.getInquiries({ userId: user!.id, agencyId, status }),
    enabled: !!user,
  });
}

export function useUpdateInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { status?: InquiryStatus; notes?: string | null } }) =>
      marketplaceService.updateInquiry(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inquiries'] }),
  });
}

export function useListingStats(agencyId: string | null, days: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['listing-stats', user?.id, agencyId, days],
    queryFn: () => marketplaceService.getListingStats(agencyId, days),
    enabled: !!user,
  });
}

export function useQuota(agencyId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['quota', user?.id, agencyId],
    queryFn: () => marketplaceService.getQuota(agencyId),
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: () => catalogService.getServiceCategories(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useServiceCategory(slug: string | undefined) {
  return useQuery({
    queryKey: ['service-categories', slug],
    queryFn: () => catalogService.getServiceCategory(slug!),
    enabled: !!slug,
  });
}

export function useSubmitServiceRequest() {
  return useMutation({ mutationFn: (input: ServiceRequestInput) => catalogService.submitServiceRequest(input) });
}

export function useAds(placement: AdPlacement) {
  return useQuery({
    queryKey: ['ads', placement],
    queryFn: () => catalogService.getAds(placement),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
