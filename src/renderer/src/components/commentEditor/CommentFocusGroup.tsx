import { createContext, useEffect, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CommentFieldHandle, FieldSelection } from './commentFieldProps';
import { blurOutcome, caretAfterMove, type GroupField } from './focusGroup';
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
  /** Its fields are being made anew as the panel moves (`panelParent`): they don't take the focus as they mount. */
  moving: () => boolean;
  moveTo: (field: GroupField, caret: 'start' | 'end') => void;
}

export const FocusGroupContext = createContext<FocusGroup | null>(null);

/**
 * A comment's title and description in one focus mode (`focusModeFields`: the check-in's, Edit comment's, a
 * changeset's details panel's): the same two editors, laid out over the window as one panel, the title over the
 * description (`focusModeLayout`), above the dialog they're in. Out of it as the focus leaves both (`blurOutcome`):
 * moving between them, or into a menu they opened, is no leaving.
 */
export function CommentFocusGroup({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<FocusModeLayout | null>(null);
  // Where the open panel moved to (`panelParent`), none while it's where the fields are.
  const [movedTo, setMovedTo] = useState<Element | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const handles = useRef(new Map<GroupField, CommentFieldHandle>());
  // The fields mount again where the panel moved: what they had of the caret goes with them (`caretAfterMove`), the
  // description's only, as only a group of one, a single description, sits in a diff's row.
  const moving = useRef<{ selection: FieldSelection | null; opening: boolean } | null>(null);
  const movingFrom = (opening: boolean): { selection: FieldSelection | null; opening: boolean } => ({ selection: handles.current.get('description')?.selection() ?? null, opening });
  const nextFrame = useRef<number | null>(null);
  const open = layout !== null;
  const group = useMemo<FocusGroup>(
    () => ({
      open,
      // Reads `layout` and `movedTo` from its render: the group is made anew as either changes.
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
      moving: () => moving.current !== null,
      moveTo: (field, caret) => {
        const handle = handles.current.get(field);
        if (caret === 'start') handle?.focusAtStart();
        else handle?.focusAtEnd();
      },
    }),
    [layout, movedTo],
  );
  // Once moved, the description takes the caret it's owed (`caretAfterMove`) as soon as its editor is there (it
  // registers once its view is made, after this group's own effects): tried on each registration until it takes it.
  function restoreMoved(): void {
    const moved = moving.current;
    const description = handles.current.get('description');
    if (!moved || !description) return;
    const caret = caretAfterMove(moved);
    if (!caret || description.focusAtSelection(caret)) moving.current = null;
  }
  useEffect(restoreMoved, [movedTo]);
  const cancelNextFrame = (): void => {
    if (nextFrame.current !== null) cancelAnimationFrame(nextFrame.current);
    nextFrame.current = null;
  };
  useEffect(() => cancelNextFrame, []);
  const onBlur = (event: FocusEvent): void => {
    if (!open) return;
    const to = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    const outcome = blurOutcome(to && { inside: container.current?.contains(to) ?? false, inMenu: to.closest('[role="menu"]') !== null });
    cancelNextFrame();
    if (outcome === 'close') group.close();
    if (outcome !== 'nextFrame') return;
    nextFrame.current = requestAnimationFrame(() => {
      nextFrame.current = null;
      if (container.current && !container.current.contains(document.activeElement)) group.close();
    });
  };
  const panel = (
    <div ref={container} className={styles.group} data-open={layout ?? undefined} onBlur={onBlur}>
      {children}
      {open && <FocusModeFooter />}
    </div>
  );
  return (
    <FocusGroupContext.Provider value={group}>
      {layout === 'overlay' && createPortal(<div className={styles.backdrop} onMouseDown={(event) => {
            // A press around it goes back to the field, the caret where it was: the focus stays in it.
            event.preventDefault();
            group.close();
          }} />, backdropParent(container.current))}
      {movedTo ? createPortal(panel, movedTo) : panel}
    </FocusGroupContext.Provider>
  );
}
