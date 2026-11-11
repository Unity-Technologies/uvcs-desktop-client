import * as Popover from '@radix-ui/react-popover';
import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import { useRef, useState, type MouseEvent } from 'react';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { useRunningOperationOfKind } from '../../app/operations/runningOperationsStore';
import { queryClient } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useHoverCard } from '../../lib/useHoverCard';
import { Button } from '../../ui/Button';
import { ProgressRing } from '../../ui/ProgressRing';
import { Spinner } from '../../ui/Spinner';
import { toast } from '../../ui/toast/toastStore';
import { IncomingCard } from './IncomingCard';
import {
  cardChangesets,
  cardCheck,
  cardFailed,
  cardItems,
  cardReadsNewest,
  chipConflictCount,
  chipCount,
  chipLabel,
  chipReadsIncomingChanges,
  incomingChipState,
} from './incomingChipState';
import { PartialIncomingCard } from './PartialIncomingCard';
import { updatePartialToIncoming, updateToIncoming } from './updateOperations';
import { incomingChangesKey, useIncomingChanges } from './useIncomingChanges';
import { useNewestIncomingChangesets } from './useIncomingChangesets';
import { useKnownIncomingSummary } from './useKnownIncomingSummary';
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
  const summary = useKnownIncomingSummary();
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
  // A partial workspace's update never merges (it keeps the local version of an item changed on both sides), so it
  // updates to the items its check already compared.
  const update = async (): Promise<void> => {
    card.close();
    if (changes && 'partial' in changes) {
      void updatePartialToIncoming(workspacePath, changes);
      return;
    }
    setVerifying(true);
    try {
      const fresh = await api.merge.incomingChanges(workspacePath);
      queryClient.setQueryData(incomingChangesKey(workspacePath), fresh);
      if (!fresh.branch || 'partial' in fresh) return;
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
          aria-label={chipLabel(state)}
          {...card.hoverProps}
          onClick={(event: MouseEvent) => {
            event.preventDefault();
            card.toggle();
          }}
        >
          {verifying ? <Spinner size={13} /> : <ArrowDownToLine size={14} className={styles.icon} />}
          <span className={styles.count}>{chipCount(state)}</span>
          {chipConflictCount(state) > 0 && (
            <span className={styles.conflicts}>
              <AlertTriangle size={13} className={styles.icon} />
              <span className={styles.count}>{chipConflictCount(state)}</span>
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
          {state.kind === 'items' ? (
            <PartialIncomingCard
              state={state}
              items={cardItems(summary, changes)}
              actions={
                <>
                  <Button size="small" variant="secondary" onClick={review}>
                    Review in Incoming
                  </Button>
                  <Button
                    size="small"
                    variant="primary"
                    icon={<ArrowDownToLine size={13} />}
                    data-tip="Download them; files you changed keep your version"
                    data-tip-sub="cm partial update"
                    onClick={() => void update()}
                  >
                    Update
                  </Button>
                </>
              }
            />
          ) : (
            <IncomingCard
              state={state}
              changesets={cardChangesets(summary, changes, newest.data)}
              failed={cardFailed(summary, changes, card, { changes: changesFailed, newest: newest.isError })}
              check={cardCheck(summary, changes, card, changesFailed)}
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
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
