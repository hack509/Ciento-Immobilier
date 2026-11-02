import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminService, type AdminUsersFilters } from '@/services/admin.service';
import { propertiesService } from '@/services/properties.service';
import { dashboardService } from '@/services/dashboard.service';
import type { Profile, PropertyStatus, Report } from '@/types';

export function useUserDashboardStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard-stats', userId],
    queryFn: () => dashboardService.getUserStats(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminService.getStats(),
    staleTime: 30 * 1000,
  });
}

export function useModerationQueue(filters: { status?: PropertyStatus | ''; query?: string; page?: number }) {
  return useQuery({
    queryKey: ['admin', 'properties', filters],
    queryFn: () => propertiesService.getForModeration(filters),
    placeholderData: keepPreviousData,
  });
}

export function useModerateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' | 'review' }) =>
      propertiesService.moderate(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useSetFeatured() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      propertiesService.setFeatured(id, isFeatured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useAdminUsers(filters: AdminUsersFilters) {
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () => adminService.getUsers(filters),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, changes }: { userId: string; changes: Partial<Pick<Profile, 'role' | 'is_active' | 'is_verified'>> }) =>
      adminService.updateUser(userId, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useAdminReports(status: Report['status'] | '') {
  return useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => adminService.getReports(status),
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Report['status'] }) =>
      adminService.updateReport(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}
