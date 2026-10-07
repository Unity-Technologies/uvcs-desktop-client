import * as Popover from '@radix-ui/react-popover';
import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import { useRef, useState, type MouseEvent } from 'react';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { useRunningOperationOfKind } from '../../app/operations/runningOperationsStore';
import { queryClient } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { formatCountAtLeast, pluralize, pluralizeAtLeast } from '../../lib/text';
import { useHoverCard } from '../../lib/useHoverCard';
import { Button } from '../../ui/Button';
import { ProgressRing } from '../../ui/ProgressRing';
import { Spinner } from '../../ui/Spinner';
import { toast } from '../../ui/toast/toastStore';
import { IncomingCard } from './IncomingCard';
import { cardChangesets, cardFailed, cardReadsNewest, chipReadsIncomingChanges, incomingChipState, knownIncomingSummary } from './incomingChipState';
import { updateToIncoming } from './updateOperations';
import { incomingChangesKey, useIncomingChanges } from './useIncomingChanges';
import { useNewestIncomingChangesets } from './useIncomingChangesets';
import { useIncomingSummary } from './useIncomingSummary';
import styles from './IncomingChip.module.css';

/**
 * A segment of the branch pill that shows up only when the branch has changesets the workspace doesn't: how many,
 * and whether they collide with local changes (read up front only below "100+": `chipReadsIncomingChanges`). Hovering
 * lists the newest, read as it opens, with Update (or Resolve in Incoming) one click away.
 */
export function IncomingChip() {
  const workspacePath = useWorkspacePath();
  const { data: checked } = useIncomingSummary();
  const card = useHoverCard();
  const { data: changes, isError: changesFailed } = useIncomingChanges({ enabled: chipReadsIncomingChanges(checked, card.open && card.pinned) });
  const summary = knownIncomingSummary(checked, changes);
  const newest = useNewestIncomingChangesets(summary, cardReadsNewest(summary, changes, card.open));
  const running = useRunningOperationOfKind(workspacePath, 'update');
  const state = incomingChipState(summary, changes, running);
  const [verifying, setVerifying] = useState(false);
  // Only a card opened by clicking takes focus, so only that one gives it back: a hover never leaves a focus ring behind.
  const tookFocus = useRef(false);

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
      else if (fresh.branch) void updateToIncoming(workspacePath, fresh);
    } catch (error) {
      toast.error("Couldn't check the incoming changes", error);
    } finally {
      setVerifying(false);
    }
  };

  if (state.kind === 'updating') {
    return (
      <div className={`${styles.chip} ${styles.updating}`} role="status">
        <ProgressRing value={state.ring} size={13} />
        <span className={styles.label}>Updating</span>
        <span className={styles.stage}>{state.stage}</span>
      </div>
    );
  }

  const conflicts = state.kind === 'conflicts';
  return (
    <Popover.Root open={card.open} onOpenChange={card.onOpenChange}>
      <Popover.Trigger asChild>
        <button
          className={styles.chip}
          aria-label={
            conflicts
              ? `${pluralizeAtLeast(state.count, state.countCapped, 'new changeset')}, ${pluralize(state.conflictCount, 'conflict')}`
              : pluralizeAtLeast(state.count, state.countCapped, 'new changeset')
          }
          {...card.hoverProps}
          onClick={(event: MouseEvent) => {
            event.preventDefault();
            card.toggle();
          }}
        >
          {verifying ? <Spinner size={13} /> : <ArrowDownToLine size={14} className={styles.icon} />}
          <span className={styles.count}>{formatCountAtLeast(state.count, state.countCapped)}</span>
          {conflicts && (
            <span className={styles.conflicts}>
              <AlertTriangle size={13} className={styles.icon} />
              <span className={styles.count}>{state.conflictCount}</span>
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.card}
          align="start"
          sideOffset={6}
          {...card.hoverProps}
          onOpenAutoFocus={(event) => {
            tookFocus.current = card.pinned;
            if (!card.pinned) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => !tookFocus.current && event.preventDefault()}
        >
          <IncomingCard
            state={state}
            changesets={cardChangesets(summary, changes, newest.data)}
            failed={cardFailed(summary, changes, card, { changes: changesFailed, newest: newest.isError })}
            checking={card.pinned}
            actions={
              <>
                <Button size="small" variant={conflicts ? 'primary' : 'secondary'} onClick={review}>
                  {conflicts ? 'Resolve in Incoming…' : 'Review in Incoming'}
                </Button>
                {!conflicts && (
                  <Button
                    size="small"
                    variant="primary"
                    icon={<ArrowDownToLine size={13} />}
                    loading={verifying}
                    data-tip="Download them; your local changes stay as they are"
                    data-tip-sub="cm update"
                    onClick={() => void update()}
                  >
                    Update
                  </Button>
                )}
              </>
            }
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
