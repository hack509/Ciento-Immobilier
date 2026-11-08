import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { billingService, type CheckoutProvider } from '@/services/billing.service';
import type { BillingCycle, PromotionKind } from '@/types/marketplace';

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: () => billingService.getPlans(), staleTime: 5 * 60 * 1000 });
}

export function useOffers(kind?: PromotionKind) {
  return useQuery({ queryKey: ['offers', kind], queryFn: () => billingService.getOffers(kind), staleTime: 5 * 60 * 1000 });
}

export function useSubscriptions(agencyId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['subscriptions', user?.id, agencyId],
    queryFn: () => billingService.getSubscriptions(user!.id, agencyId),
    enabled: !!user,
  });
}

export function usePayments(agencyId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['payments', user?.id, agencyId],
    queryFn: () => billingService.getPayments(user!.id, agencyId),
    enabled: !!user,
  });
}

export function useInvoices(agencyId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['invoices', user?.id, agencyId],
    queryFn: () => billingService.getInvoices(user!.id, agencyId),
    enabled: !!user,
  });
}

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: () => billingService.getPayment(id!),
    enabled: !!id,
  });
}

export function usePromotions(propertyIds: string[]) {
  return useQuery({
    queryKey: ['promotions', propertyIds],
    queryFn: () => billingService.getPromotions(propertyIds),
    enabled: propertyIds.length > 0,
  });
}

function useInvalidateBilling() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['subscriptions', 'payments', 'invoices', 'quota', 'promotions', 'properties', 'payment']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useCheckout() {
  const invalidate = useInvalidateBilling();
  return {
    subscription: useMutation({
      mutationFn: (v: { planId: string; cycle: BillingCycle; provider: CheckoutProvider; agencyId: string | null }) =>
        billingService.checkoutSubscription(v.planId, v.cycle, v.provider, v.agencyId),
      onSuccess: invalidate,
    }),
    renewal: useMutation({
      mutationFn: (v: { subscriptionId: string; provider: CheckoutProvider }) =>
        billingService.checkoutRenewal(v.subscriptionId, v.provider),
      onSuccess: invalidate,
    }),
    promotion: useMutation({
      mutationFn: (v: { kind: PromotionKind; propertyId: string; offerId: string; provider: CheckoutProvider }) =>
        billingService.checkoutPromotion(v.kind, v.propertyId, v.offerId, v.provider),
      onSuccess: invalidate,
    }),
    trial: useMutation({
      mutationFn: (v: { planId: string; cycle: BillingCycle; agencyId: string | null }) =>
        billingService.startTrial(v.planId, v.cycle, v.agencyId),
      onSuccess: invalidate,
    }),
  };
}

export function useSubscriptionActions() {
  const invalidate = useInvalidateBilling();
  return {
    setCancellation: useMutation({
      mutationFn: (v: { subscriptionId: string; cancel: boolean }) => billingService.setCancellation(v.subscriptionId, v.cancel),
      onSuccess: invalidate,
    }),
    redeemCredit: useMutation({
      mutationFn: (propertyId: string) => billingService.redeemCredit(propertyId),
      onSuccess: invalidate,
    }),
    cancelPayment: useMutation({
      mutationFn: (paymentId: string) => billingService.cancelPayment(paymentId),
      onSuccess: invalidate,
    }),
    callProvider: useMutation({
      mutationFn: (v: { action: 'start' | 'verify'; paymentId: string }) => billingService.callPaymentFunction(v.action, v.paymentId),
      onSuccess: invalidate,
    }),
  };
}
