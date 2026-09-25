import type { ReactNode } from 'react';
import { create } from 'zustand';

type RenderDialog = (close: () => void) => ReactNode;

interface OpenDialog {
  id: number;
  render: RenderDialog;
}

interface DialogStore {
  dialogs: OpenDialog[];
  open: (render: RenderDialog) => void;
  close: (id: number) => void;
}

let nextDialogId = 1;

export const useDialogStore = create<DialogStore>((set) => ({
  dialogs: [],
  open: (render) => set((state) => ({ dialogs: [...state.dialogs, { id: nextDialogId++, render }] })),
  close: (id) => set((state) => ({ dialogs: state.dialogs.filter((dialog) => dialog.id !== id) })),
}));

/** Shows a dialog from anywhere (e.g. a menu action). `render` receives a function that closes it. */
export function openDialog(render: RenderDialog): void {
  useDialogStore.getState().open(render);
}

/** Like `openDialog`, but resolves with the value the dialog finishes with (or `undefined` if dismissed). */
export function askDialog<T>(render: (finish: (value: T | undefined) => void) => ReactNode): Promise<T | undefined> {
  return new Promise((resolve) => {
    openDialog((close) =>
      render((value) => {
        close();
        resolve(value);
      }),
    );
  });
}
