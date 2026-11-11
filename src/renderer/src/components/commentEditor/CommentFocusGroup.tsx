import { createContext, useEffect, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CommentFieldHandle, FieldSelection } from './commentFieldProps';
import { focusLeavesGroup, type GroupField } from './focusGroup';
import { focusModeLayout, type FocusModeLayout } from './focusMode';
import { backdropParent, panelParent } from './backdropParent';
import { FocusModeFooter } from './FocusModeFooter';
import styles from './CommentFocusGroup.module.css';

/** What the fields of a group share: one focus mode, and a way to put the caret in another of them. */
export interface FocusGroup {
  open: boolean;
  toggle: () => void;
  close: () => void;
  register: (field: GroupField, handle: CommentFieldHandle | null) => void;
  moveTo: (field: GroupField, caret: 'start' | 'end') => void;
}

export const FocusGroupContext = createContext<FocusGroup | null>(null);

/**
 * A comment's title and description in one focus mode (`focusModeFields`: the check-in's, Edit comment's, a
 * changeset's details panel's): the same two editors, laid out over the window as one panel, the title over the
 * description (`focusModeLayout`), above the dialog they're in. Out of it as the focus leaves both (`focusLeavesGroup`):
 * moving between them, or into a menu they opened, is no leaving.
 */
export function CommentFocusGroup({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<FocusModeLayout | null>(null);
  // Where the open panel moved to (`panelParent`), none while it's where the fields are.
  const [movedTo, setMovedTo] = useState<Element | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const handles = useRef(new Map<GroupField, CommentFieldHandle>());
  // The fields mount again where the panel moved: the caret and selection they had go with them, the focus too.
  const moving = useRef<{ selection: FieldSelection | null; opening: boolean } | null>(null);
  const movingFrom = (opening: boolean): { selection: FieldSelection | null; opening: boolean } => ({ selection: handles.current.get('description')?.selection() ?? null, opening });
  const open = layout !== null;
  const group = useMemo<FocusGroup>(
    () => ({
      open,
      toggle: () => {
        const opening = layout === null;
        const parent = opening ? panelParent(container.current) : null;
        moving.current = parent !== null || movedTo !== null ? movingFrom(opening) : null;
        setMovedTo(parent);
        setLayout(opening ? focusModeLayout() : null);
      },
      close: () => {
        moving.current = movedTo !== null ? movingFrom(false) : null;
        setMovedTo(null);
        setLayout(null);
      },
      register: (field, handle) => {
        if (handle) handles.current.set(field, handle);
        else handles.current.delete(field);
        if (handle && field === 'description') restoreMoved();
      },
      moveTo: (field, caret) => {
        const handle = handles.current.get(field);
        if (caret === 'start') handle?.focusAtStart();
        else handle?.focusAtEnd();
      },
    }),
    [open, layout, movedTo],
  );
  // Once moved, the description takes back its caret and selection: as soon as its editor is there (it registers once
  // its view is made, after this group's own effects), so tried on each registration until it takes them.
  function restoreMoved(): void {
    const moved = moving.current;
    const description = handles.current.get('description');
    if (!moved || !description) return;
    if (moved.selection) {
      if (description.focusAtSelection(moved.selection)) moving.current = null;
      return;
    }
    // Opened with no caret in it (by its button): the panel's field takes the focus at the text's end. Closed with
    // none (a press outside, the focus gone elsewhere): it stays where the user put it.
    if (moved.opening) description.focusAtEnd();
    moving.current = null;
  }
  useEffect(restoreMoved, [movedTo]);
  const onBlur = (event: FocusEvent): void => {
    // Moved, the fields mount anew and the editor that was focused is told it lost the focus after the new one took it,
    // going nowhere: the panel closes only if the focus isn't back in it a frame later.
    if (movedTo && !event.relatedTarget) {
      requestAnimationFrame(() => {
        if (!container.current?.contains(document.activeElement)) group.close();
      });
      return;
    }
    const to = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    const moved = to && { inside: container.current?.contains(to) ?? false, inMenu: to.closest('[role="menu"]') !== null };
    if (open && focusLeavesGroup(moved)) group.close();
  };
  const panel = (
    <div ref={container} className={styles.group} data-open={layout ?? undefined} onBlur={onBlur}>
      {children}
      {open && <FocusModeFooter />}
    </div>
  );
  return (
    <FocusGroupContext.Provider value={group}>
      {layout === 'overlay' && createPortal(<div className={styles.backdrop} onMouseDown={() => group.close()} />, backdropParent(container.current))}
      {movedTo ? createPortal(panel, movedTo) : panel}
    </FocusGroupContext.Provider>
  );
}
