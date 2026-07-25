import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { SignInParams, SignUpParams } from '@/services/auth.service';

export function useAuthMutations() {
  const queryClient = useQueryClient();
  const { signIn, signUp, signOut, resetPassword } = useAuth();

  const signInMutation = useMutation({
    mutationFn: (params: SignInParams) => signIn(params),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const signUpMutation = useMutation({
    mutationFn: (params: SignUpParams) => signUp(params),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const signOutMutation = useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (email: string) => resetPassword(email),
  });

  return {
    signIn: signInMutation,
    signUp: signUpMutation,
    signOut: signOutMutation,
    resetPassword: resetPasswordMutation,
  };
}
