import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AnnotateColumns {
  author: boolean;
  changeset: boolean;
  date: boolean;
}

interface AnnotateOptionsStore {
  columns: AnnotateColumns;
  toggleColumn: (column: keyof AnnotateColumns) => void;
}

export const useAnnotateOptions = create<AnnotateOptionsStore>()(
  persist(
    (set) => ({
      columns: { author: true, changeset: true, date: true },
      toggleColumn: (column) => set((state) => ({ columns: { ...state.columns, [column]: !state.columns[column] } })),
    }),
    { name: 'annotate-options' },
  ),
);
