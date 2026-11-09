import { createContext, useContext } from 'react';

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  // Outside the provider (tests, isolated renders) toasts are silently ignored.
  return ctx ?? { success: () => {}, error: () => {}, info: () => {} };
}
