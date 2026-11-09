import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastApi } from './toast-context';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; tone: ToastTone; message: string }

const icons = { success: CheckCircle2, error: AlertTriangle, info: Info };
const tones = {
  success: 'border-success-500/30 bg-white text-success-700',
  error: 'border-danger-500/30 bg-white text-danger-600',
  info: 'border-brand-blue/30 bg-white text-brand-blue',
};

/** Lightweight toasts: immediate feedback for every important action (aria-live). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setItems((all) => [...all.slice(-3), { id, tone, message }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'}
              className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 text-sm shadow-float animate-in', tones[t.tone])}>
              <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <p className="flex-1 text-gray-800">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Fermer" className="rounded p-0.5 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

