import { useState, type RefObject } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { useViewSelection } from '../../app/navigation/viewSelectionStore';
import { EMPTY_SELECTION } from '../../lib/selection';
import { checkinFromPanel, shelveFromPanel, type PanelCheckin, type WhileRunning } from './submitCheckinPanel';

interface CheckinPanelSubmit {
  /** A check-in or shelve is running: the panel's button spins and waits. */
  busy: boolean;
  checkin: () => Promise<void>;
  /** True once shelved. */
  shelve: (keep: boolean) => Promise<boolean>;
}

/**
 * What the check-in panel's button runs, and whether it is running. A check-in waiting for a comment puts the caret in
 * the summary (writing one is the way on); one that made a changeset leaves nothing selected.
 */
export function useCheckinPanelSubmit(request: PanelCheckin, shelvable: PendingChange[], summaryRef: RefObject<HTMLInputElement | null>): CheckinPanelSubmit {
  const [busy, setBusy] = useState(false);
  const [, setSelection] = useViewSelection('changes');

  const whileBusy: WhileRunning = async (run) => {
    setBusy(true);
    try {
      return await run();
    } finally {
      setBusy(false);
    }
  };

  const checkin = async (): Promise<void> => {
    const outcome = await checkinFromPanel(request, whileBusy);
    if (outcome === 'writeComment') summaryRef.current?.focus();
    if (outcome === 'checkedIn') setSelection(EMPTY_SELECTION);
  };
  const shelve = (keep: boolean): Promise<boolean> => shelveFromPanel(request.workspacePath, shelvable, keep, whileBusy);
  return { busy, checkin, shelve };
}
