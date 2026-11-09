import { createContext, type ComponentType } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';

export interface EntryMarkProps {
  target: DiffTarget;
  entry: DiffEntry;
}

/**
 * The component a place puts by the status letter of each file's row in a `DiffBrowser`'s list (`ItemMark`): a review
 * marks the files holding comments; none elsewhere. A component rather than values, so what it reads is its own.
 */
export const EntryMarkContext = createContext<ComponentType<EntryMarkProps> | null>(null);
