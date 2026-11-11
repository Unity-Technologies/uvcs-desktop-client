import { useCallback, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { RepositoryPlace } from '@shared/domain/place';
import { hotkey } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { repositoryFileSearchKey, repositoryFileSearchView, searchesFor, type RepositoryFileSearchView } from './repositoryFileSearch';
import { useGoToFileCommand } from './useGoToFileCommand';
import { useRepositoryFileSearch } from './useRepositoryFileSearch';

export interface RepositoryTreeSearchOptions {
  place: RepositoryPlace;
  /** The changeset whose tree is searched; null while it isn't known yet. */
  changesetId: number | null;
  /** What the search note calls the tree searched, such as the branch's name. */
  name: string;
  /** Shows the item picked in the tree. */
  onReveal: (path: string) => void;
}

export interface RepositoryTreeSearch {
  query: string;
  setQuery: (query: string) => void;
  /** Whether the results show in place of the tree. */
  searching: boolean;
  /** Whether there's a tree to search: the field is greyed until its changeset is known. */
  enabled: boolean;
  /** The results' element id, for the field's `aria-controls`. */
  resultsId: string;
  view: RepositoryFileSearchView;
  highlighted: number;
  setHighlighted: (index: number) => void;
  pick: (path: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Brings the keyboard to the search field: ⌘P, `/` in the tree, the palette's "Go to file…". */
  focus: () => void;
}

/**
 * The search over a repository's whole tree at a changeset that Files and Browse repository show above their tree, as
 * Choose what to download does: results replace the tree while something is typed, and a pick shows the item in the
 * tree and clears the query. The tree is listed only once the user types (`useRepositoryFileSearch`).
 */
export function useRepositoryTreeSearch({ place, changesetId, name, onReveal }: RepositoryTreeSearchOptions): RepositoryTreeSearch {
  const [query, setQueryState] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsId = useId();
  const view = repositoryFileSearchView(useRepositoryFileSearch(place, changesetId, query), query, name);

  const focus = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const enabled = changesetId !== null;
  useGoToFileCommand(enabled ? focus : null);
  useShortcut(hotkey('filesGoToFile'), focus, enabled);

  const setQuery = (next: string): void => {
    setQueryState(next);
    setHighlighted(0);
  };
  const pick = (path: string): void => {
    setQuery('');
    onReveal(path);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    const key = repositoryFileSearchKey(event.key, highlighted, view);
    if (!key) return;
    event.preventDefault();
    if (key.kind === 'highlight') setHighlighted(key.index);
    else pick(key.path);
  };

  return { query, setQuery, searching: searchesFor(query), enabled, resultsId, view, highlighted, setHighlighted, pick, onKeyDown, inputRef, focus };
}
