import { useEffect, useMemo, useRef, useState } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import { singleSelection, type SelectionState } from '../../lib/selection';
import { hotkey } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { changesetListChoice, type ChangesetListChoice } from './changesetListChoice';
import {
  ALL_CHANGES_KEY,
  appliesFocus,
  changesetListRowKey,
  changesetListRows,
  changesetListSelection,
  changesetStep,
  filterChangesets,
  focusRevealKey,
  focusSelection,
  oldestFirst,
  selectedChangesetIds,
  type AppliedFocus,
  type ChangesetListFocus,
  type ChangesetListRow,
} from './changesetStepListModel';

interface ChangesetStepListOptions {
  /** The changesets, newest first, as `cm find` reads them; undefined while they're read. */
  changesets: readonly Changeset[] | undefined;
  /** What the place asks the list to select: a new object each time it asks, as it opens and later. */
  focus: ChangesetListFocus;
  /** After the selection changes, however it does (a click, a key, a step): the place's own reset. */
  onSelect?: (selection: SelectionState) => void;
  /** The place shows the combined row itself, above the list (`changesetListRows`). */
  allApart?: boolean;
  /** Whether ⌥⇧↓ ⌥⇧↑ step: only while the list shows (`changesetStepsWork`), or a step changes the diff out of sight. */
  stepsEnabled?: boolean;
}

/** What `ChangesetStepList` draws and how it's driven. */
export interface ChangesetStepListState {
  changesets: readonly Changeset[] | undefined;
  rows: readonly ChangesetListRow[];
  /** The changesets the filter shows, oldest first: the rows', without the combined one. */
  shown: readonly Changeset[];
  query: string;
  setQuery: (query: string) => void;
  selection: SelectionState;
  /** Selects `next` as the list keeps selections (`changesetListSelection`), bringing `reveal` into view. */
  select: (next: SelectionState, reveal?: string | null) => void;
  /** The row brought into view: the one stepped to, or asked for. */
  revealKey: string | null;
  /** The changeset the buttons and keys step to, down (1, newer) or up (-1, older); null at either end. */
  stepsTo: (step: 1 | -1) => number | null;
  stepTo: (step: 1 | -1) => void;
  /** What the selection shows: everything combined, a changeset, or a span of them. */
  choice: ChangesetListChoice;
}

/**
 * The state of a list of changesets stepped through (`ChangesetStepList`): its filter, its selection (opening on what
 * the place asks for, and again each time it asks), and the steps through it, from the buttons and from anywhere in
 * the view but a text field (⌥⇧↓ ⌥⇧↑, `nextChangeset`, `previousChangeset`: ⌥⇧ selects text to its ends on macOS).
 */
export function useChangesetStepList({ changesets, focus, onSelect, allApart = false, stepsEnabled = true }: ChangesetStepListOptions): ChangesetStepListState {
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<SelectionState>(() => focusSelection(focus, changesets));
  const [revealKey, setRevealKey] = useState<string | null>(() => focusRevealKey(focus));
  // Oldest on top, as the changesets were checked in; the read stays newest first for what asks for the newest.
  const listed = useMemo(() => oldestFirst(changesets ?? []), [changesets]);
  const shown = useMemo(() => filterChangesets(listed, query), [listed, query]);
  const rows = useMemo(() => changesetListRows(shown, query, { allApart }), [shown, query, allApart]);
  const rowKeys = useMemo(() => rows.map(changesetListRowKey), [rows]);

  const select = (next: SelectionState, reveal: string | null = null): void => {
    const kept = changesetListSelection(next, rowKeys);
    setSelection(kept);
    setRevealKey(reveal);
    onSelect?.(kept);
  };

  // Each focus once, and a span's again once the changesets are read (`appliesFocus`).
  const read = changesets !== undefined;
  const applied = useRef<AppliedFocus | null>(null);
  useEffect(() => {
    if (!appliesFocus(applied.current, focus, read)) return;
    applied.current = { focus, read };
    setSelection(focusSelection(focus, changesets));
    setRevealKey(focusRevealKey(focus));
  }, [focus, read]);

  const anchorId = selection.anchor === null || selection.anchor === ALL_CHANGES_KEY ? null : Number(selection.anchor);
  const stepsTo = (step: 1 | -1): number | null => (changesets ? changesetStep(listed, shown, anchorId, step) : null);
  const stepTo = (step: 1 | -1): void => {
    const id = stepsTo(step);
    if (id !== null) select(singleSelection(String(id)), String(id));
  };
  useShortcut(hotkey('nextChangeset'), () => stepTo(1), stepsEnabled, { whileTyping: false });
  useShortcut(hotkey('previousChangeset'), () => stepTo(-1), stepsEnabled, { whileTyping: false });

  const choice = changesetListChoice(changesets, selectedChangesetIds(selection));
  return { changesets, rows, shown, query, setQuery, selection, select, revealKey, stepsTo, stepTo, choice };
}
