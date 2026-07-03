'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

interface ToastState {
  toasts: ToastProps[];
  add: (toast: Omit<ToastProps, 'id'>) => void;
  remove: (id: string) => void;
}

const ToastContext = React.createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const add = React.useCallback((toast: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const remove = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, add, remove }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    // Fallback for when used outside provider
    return {
      toast: (props: Omit<ToastProps, 'id'>) => {
        console.log('Toast:', props);
      },
    };
  }
  return { toast: ctx.add, dismiss: ctx.remove };
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  // Simple standalone toaster
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'rounded-lg border p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-2',
            t.variant === 'destructive'
              ? 'bg-red-950/90 border-red-800 text-red-100'
              : t.variant === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-100'
              : 'bg-card/90 border-border text-foreground',
          )}
        >
          {t.title && <p className="font-medium text-sm">{t.title}</p>}
          {t.description && <p className="text-xs opacity-80 mt-0.5">{t.description}</p>}
        </div>
      ))}
    </div>
  );
}
