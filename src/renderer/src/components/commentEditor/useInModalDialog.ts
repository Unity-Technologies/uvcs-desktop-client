import { useLayoutEffect, useState, type RefObject } from 'react';
import { isInModalDialog } from '../../lib/modalDialog';

/** Whether the element is in a modal dialog, known once it's in the page, before it's painted. */
export function useInModalDialog(element: RefObject<HTMLElement | null>): boolean {
  const [inDialog, setInDialog] = useState(false);
  useLayoutEffect(() => setInDialog(isInModalDialog(element.current)), [element]);
  return inDialog;
}
