import { ArrowDownToLine } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { PartialIncomingChanges } from '@shared/domain/incoming';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { ItemIcon } from '../../components/ItemIcon';
import { PathLabel } from '../../components/PathLabel';
import { branchLabel } from '../../lib/branchLabels';
import { fileNameOf, pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { EmptyState } from '../../ui/EmptyState';
import { IncomingFileDiff } from './IncomingDetail';
import { IncomingPanes } from './IncomingPanes';
import { updatePartialToIncoming } from './updateOperations';
import { firstPartialItemKey, partialItemDetail, partialItemGroups, partialItemKey, partialSelectionDetail } from './partialIncomingItems';
import {
  canUpdateSelection,
  partialGroupCheckState,
  partialItemChecked,
  partialUpdateMessage,
  partialUpdateSelection,
  withItemsChecked,
  type UncheckedItems,
} from './partialIncomingSelection';
import styles from './PartialIncomingSession.module.css';
import barStyles from './UpdateBar.module.css';

interface PartialIncomingSessionProps {
  workspacePath: string;
  incoming: PartialIncomingChanges;
  /** The view's header, saying the words given. */
  header: (subtitle: string) => ReactNode;
}

/**
 * Incoming in a partial workspace: it loads no one changeset, so it lists the items the branch head would change,
 * grouped by what the branch did to them, with each item's diff, and updates to the items checked.
 */
export function PartialIncomingSession({ workspacePath, incoming, header }: PartialIncomingSessionProps) {
  const repository = useWorkspaceInfo().data?.repository;
  const groups = partialItemGroups(incoming.items);
  const [selectedKey, setSelectedKey] = useState(() => firstPartialItemKey(groups));
  const [updating, setUpdating] = useState(false);
  const detail = partialSelectionDetail(incoming.items, selectedKey, repository);
  const [unchecked, setUnchecked] = useState<UncheckedItems>(() => new Set());
  const selection = partialUpdateSelection(incoming.items, unchecked);
  const canUpdate = canUpdateSelection(selection);

  const update = async () => {
    setUpdating(true);
    try {
      await updatePartialToIncoming(workspacePath, incoming, selection);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      {header(`${pluralize(incoming.items.length, 'item')} from ${branchLabel(incoming.branch)}`)}
      <div className={barStyles.bar}>
        <ArrowDownToLine size={15} className={barStyles.icon} />
        <span className={barStyles.text}>{partialUpdateMessage(incoming.branch, selection, unchecked)}</span>
        {canUpdate && (
          <Button variant="primary" loading={updating} onClick={() => void update()}>
            Update workspace
          </Button>
        )}
      </div>
      <IncomingPanes
        list={
          <div className={styles.list}>
            {groups.map((group) => (
              <section key={group.title}>
                <h3 className={styles.title}>
                  <Checkbox
                    checked={partialGroupCheckState(group.items, unchecked)}
                    ariaLabel={`Bring every item in ${group.title}`}
                    onChange={(checked) => setUnchecked(withItemsChecked(unchecked, group.items, checked))}
                  />
                  {group.title} <span className={styles.count}>{group.items.length}</span>
                </h3>
                {group.items.map((item) => {
                  const key = partialItemKey(item);
                  return (
                    <div key={key} className={styles.row} data-selected={key === selectedKey}>
                      <span className={styles.check}>
                        <Checkbox
                          checked={partialItemChecked(item, unchecked)}
                          ariaLabel={`Bring ${item.path}`}
                          onChange={(checked) => setUnchecked(withItemsChecked(unchecked, [item], checked))}
                        />
                      </span>
                      <button type="button" className={styles.item} onClick={() => setSelectedKey(key)}>
                        <span className={styles.icon}>
                          <ItemIcon itemType={item.isDirectory ? 'directory' : 'file'} name={fileNameOf(item.path)} />
                        </span>
                        <span className={styles.text}>
                          <span className={styles.path}>
                            <PathLabel path={item.path} oldPath={item.oldPath} />
                          </span>
                          <span className={styles.meta}>{partialItemDetail(item)}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        }
        detail={
          detail.kind === 'diff' ? (
            <IncomingFileDiff key={detail.entry.path} workspacePath={workspacePath} file={detail.entry} />
          ) : (
            <EmptyState title={detail.title} />
          )
        }
      />
    </>
  );
}
