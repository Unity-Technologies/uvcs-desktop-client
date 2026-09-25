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
  /** What an error toast reports; the toast host can offer its details. */
  error?: unknown;
}

interface ToastStore {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => number;
  update: (id: number, changes: Partial<Omit<Toast, 'id'>>) => void;
  dismiss: (id: number) => void;
}

/** How long each kind stays up. The toast's countdown bar runs the timer, so hovering it holds the toast open. */
export const AUTO_DISMISS_MS: Record<ToastKind, number | null> = {
  info: 4000,
  success: 4000,
  error: 9000,
  progress: null,
};

let nextToastId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = nextToastId++;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  update: (id, changes) => set((state) => ({ toasts: state.toasts.map((toast) => (toast.id === id ? { ...toast, ...changes } : toast)) })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const toast = {
  info: (title: string, detail?: string) => useToastStore.getState().show({ kind: 'info', title, detail }),
  success: (title: string, detail?: string, action?: ToastAction) =>
    useToastStore.getState().show({ kind: 'success', title, detail, action }),
  /** `error` is an exception, or a sentence that explains the failure. */
  error: (title: string, error?: unknown) => useToastStore.getState().show({ kind: 'error', title, detail: describeError(error), error }),
};

function describeError(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : undefined;
}
