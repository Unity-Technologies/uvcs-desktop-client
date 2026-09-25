import * as Popover from '@radix-ui/react-popover';
import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { useRunningOperation } from '../../app/operations/runningOperationsStore';
import { queryClient } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { pluralize } from '../../lib/text';
import { useHoverCard } from '../../lib/useHoverCard';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { toast } from '../../ui/toast/toastStore';
import { IncomingCard } from './IncomingCard';
import { incomingChipState } from './incomingChipState';
import { updateToIncoming } from './updateOperations';
import { incomingChangesKey, useIncomingChanges } from './useIncomingChanges';
import { useIncomingSummary } from './useIncomingSummary';
import styles from './IncomingChip.module.css';

/**
 * Shows up next to the branch only when the branch has changesets the workspace doesn't: one click updates,
 * or, when they collide with local changes, leads to Incoming to merge them. Hovering lists them.
 */
export function IncomingChip() {
  const workspacePath = useWorkspacePath();
  const { data: summary } = useIncomingSummary();
  const hasIncoming = Boolean(summary?.branch && summary.changesetCount > 0);
  const { data: changes } = useIncomingChanges({ enabled: hasIncoming });
  const running = useRunningOperation(workspacePath);
  const state = incomingChipState(summary, changes, running);
  const card = useHoverCard();
  const [verifying, setVerifying] = useState(false);

  // An update's stage changes many times a second: hold the chip's width so the toolbar doesn't jitter.
  const chipRef = useRef<HTMLDivElement>(null);
  const restingWidth = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (state && state.kind !== 'updating' && chipRef.current) restingWidth.current = chipRef.current.offsetWidth;
  });

  if (!state) return null;

  const review = (): void => {
    card.close();
    navigation.goToView('incoming');
  };

  // Local changes may have changed since the last check: look again right before updating, and never update blindly.
  const update = async (): Promise<void> => {
    card.close();
    setVerifying(true);
    try {
      const fresh = await api.merge.incomingChanges(workspacePath);
      queryClient.setQueryData(incomingChangesKey(workspacePath), fresh);
      if (fresh.conflicts.length + fresh.blockedPaths.length > 0) navigation.goToView('incoming');
      else void updateToIncoming(workspacePath, fresh);
    } catch (error) {
      toast.error("Couldn't check the incoming changes", error);
    } finally {
      setVerifying(false);
    }
  };

  if (state.kind === 'updating') {
    return (
      <div
        ref={chipRef}
        className={styles.chip}
        data-tone="updating"
        style={restingWidth.current !== null ? { width: restingWidth.current } : undefined}
        role="status"
      >
        <span className={styles.body}>
          <Spinner size={13} />
          <span className={styles.text}>
            <span className={styles.label}>Updating…</span>
            <span className={styles.stage}>{state.stage}</span>
          </span>
        </span>
      </div>
    );
  }

  const conflicts = state.kind === 'conflicts';
  const label = conflicts ? `${pluralize(state.count, 'new changeset')} · ${pluralize(state.conflictCount, 'conflict')}` : pluralize(state.count, 'new changeset');
  const primary = conflicts ? (
    <button className={styles.primary} data-tip="Merge the files changed on both sides in Incoming" onClick={review}>
      Resolve…
    </button>
  ) : (
    <button className={styles.primary} disabled={verifying} data-tip="Download them; your local changes stay as they are" data-tip-sub="cm update" onClick={() => void update()}>
      {verifying && <Spinner size={11} />}
      Update
    </button>
  );

  return (
    <div ref={chipRef} className={styles.chip} data-tone={state.kind}>
      <Popover.Root open={card.open} onOpenChange={card.onOpenChange}>
        <Popover.Trigger asChild>
          <button
            className={styles.body}
            {...card.hoverProps}
            onClick={(event: MouseEvent) => {
              event.preventDefault();
              card.toggle();
            }}
          >
            {conflicts ? <AlertTriangle size={14} /> : <ArrowDownToLine size={14} />}
            <span className={styles.label}>{label}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.card}
            align="start"
            sideOffset={6}
            {...card.hoverProps}
            onOpenAutoFocus={(event) => !card.pinned && event.preventDefault()}
          >
            <IncomingCard
              state={state}
              changes={changes}
              actions={
                <>
                  <Button size="small" variant={conflicts ? 'primary' : 'secondary'} onClick={review}>
                    {conflicts ? 'Resolve in Incoming…' : 'Review in Incoming'}
                  </Button>
                  {!conflicts && (
                    <Button size="small" variant="primary" loading={verifying} onClick={() => void update()}>
                      Update
                    </Button>
                  )}
                </>
              }
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {primary}
    </div>
  );
}
