import * as Popover from '@radix-ui/react-popover';
import { AlertTriangle, ArrowDownToLine } from 'lucide-react';
import { useRef, useState, type MouseEvent } from 'react';
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
 * A segment of the branch pill that shows up only when the branch has changesets the workspace doesn't: how many,
 * and whether they collide with local changes. Hovering lists them, with Update (or Resolve in Incoming) one click away.
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
        <Spinner size={13} />
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
              ? `${pluralize(state.count, 'new changeset')}, ${pluralize(state.conflictCount, 'conflict')}`
              : pluralize(state.count, 'new changeset')
          }
          {...card.hoverProps}
          onClick={(event: MouseEvent) => {
            event.preventDefault();
            card.toggle();
          }}
        >
          {verifying ? <Spinner size={13} /> : <ArrowDownToLine size={14} className={styles.icon} />}
          <span className={styles.count}>{state.count}</span>
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
            changes={changes}
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
