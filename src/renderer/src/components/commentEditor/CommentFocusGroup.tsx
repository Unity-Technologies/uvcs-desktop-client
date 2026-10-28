import { createContext, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { FocusModeFooter } from './FocusModeFooter';
import { createPortal } from 'react-dom';
import type { CommentFieldHandle } from './commentFieldProps';
import type { GroupField } from './focusGroup';
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
 * The check-in's summary and description in one focus mode (`focusModeFields`): the same two editors, laid out over
 * the view as one panel, the summary a title over the description. Out of it as the focus leaves both: moving between
 * them is no leaving.
 */
export function CommentFocusGroup({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const handles = useRef(new Map<GroupField, CommentFieldHandle>());
  const group = useMemo<FocusGroup>(
    () => ({
      open,
      toggle: () => setOpen((shown) => !shown),
      close: () => setOpen(false),
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
    [open],
  );
  const onBlur = (event: FocusEvent): void => {
    if (open && !container.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  };
  return (
    <FocusGroupContext.Provider value={group}>
      {open && createPortal(<div className={styles.backdrop} onMouseDown={() => setOpen(false)} />, document.body)}
      <div ref={container} className={styles.group} data-open={open || undefined} onBlur={onBlur}>
        {children}
        {open && <FocusModeFooter />}
      </div>
    </FocusGroupContext.Provider>
  );
}
