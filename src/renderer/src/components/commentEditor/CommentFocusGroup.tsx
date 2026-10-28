import { createContext, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CommentFieldHandle } from './commentFieldProps';
import { focusLeavesGroup, type GroupField } from './focusGroup';
import { focusModeLayout, groupShowsHints, type FocusModeLayout } from './focusMode';
import { useInModalDialog } from './useInModalDialog';
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
 * A comment's title and description in one focus mode (`focusModeFields`: the check-in's, Edit comment's): the same
 * two editors, laid out over the view as one panel, the title over the description, or grown in place in a dialog
 * (`focusModeLayout`), as a dialog keeps its focus and clicks. Out of it as the focus leaves both (`focusLeavesGroup`):
 * moving between them, or into a menu they opened, is no leaving.
 */
export function CommentFocusGroup({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<FocusModeLayout | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const handles = useRef(new Map<GroupField, CommentFieldHandle>());
  const open = layout !== null;
  const inDialog = useInModalDialog(container);
  const group = useMemo<FocusGroup>(
    () => ({
      open,
      toggle: () => setLayout((shown) => (shown ? null : focusModeLayout(inDialog))),
      close: () => setLayout(null),
      register: (field, handle) => {
        if (handle) handles.current.set(field, handle);
        else handles.current.delete(field);
      },
      moveTo: (field, caret) => {
        const handle = handles.current.get(field);
        if (caret === 'start') handle?.focusAtStart();
        else handle?.focusAtEnd();
      },
    }),
    [open, inDialog],
  );
  const onBlur = (event: FocusEvent): void => {
    const to = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    const moved = to && { inside: container.current?.contains(to) ?? false, inMenu: to.closest('[role="menu"]') !== null };
    if (open && focusLeavesGroup(moved)) setLayout(null);
  };
  return (
    <FocusGroupContext.Provider value={group}>
      {layout === 'overlay' && createPortal(<div className={styles.backdrop} onMouseDown={() => setLayout(null)} />, document.body)}
      <div ref={container} className={styles.group} data-open={layout ?? undefined} onBlur={onBlur}>
        {children}
        {groupShowsHints({ open, inDialog }) && <FocusModeFooter />}
      </div>
    </FocusGroupContext.Provider>
  );
}
