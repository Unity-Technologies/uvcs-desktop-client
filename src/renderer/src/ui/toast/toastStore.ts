import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error' | 'progress';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: ToastAction;
}

interface ToastStore {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => number;
  update: (id: number, changes: Partial<Omit<Toast, 'id'>>) => void;
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS: Record<ToastKind, number | null> = {
  info: 4000,
  success: 4000,
  error: 9000,
  progress: null,
};

let nextToastId = 1;

export const useToastStore = create<ToastStore>((set, get) => {
  const scheduleDismiss = (id: number, kind: ToastKind): void => {
    const delay = AUTO_DISMISS_MS[kind];
    if (delay !== null) setTimeout(() => get().dismiss(id), delay);
  };

  return {
    toasts: [],
    show: (toast) => {
      const id = nextToastId++;
      set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
      scheduleDismiss(id, toast.kind);
      return id;
    },
    update: (id, changes) => {
      set((state) => ({ toasts: state.toasts.map((toast) => (toast.id === id ? { ...toast, ...changes } : toast)) }));
      if (changes.kind) scheduleDismiss(id, changes.kind);
    },
    dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  };
});

export const toast = {
  info: (title: string, detail?: string) => useToastStore.getState().show({ kind: 'info', title, detail }),
  success: (title: string, detail?: string, action?: ToastAction) =>
    useToastStore.getState().show({ kind: 'success', title, detail, action }),
  error: (title: string, error?: unknown) =>
    useToastStore.getState().show({ kind: 'error', title, detail: error instanceof Error ? error.message : undefined }),
};
