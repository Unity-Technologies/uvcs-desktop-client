import type { TreeItem } from '@shared/domain/explorer';
import { firstLine } from '../../lib/text';
import { displayName } from '../../lib/userName';
import { useOtherRepository } from '../../app/workspace/useWorkspace';
import { RelativeTime } from '../../ui/RelativeTime';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { showShelveChanges } from '../shelves/shelveOperations';
import type { ItemComparison } from './itemComparison';
import styles from './ComparisonTitle.module.css';

const NEW_FILE_TITLES = { added: 'New file', private: 'Private file', ignored: 'Ignored file' } as const;

interface ComparisonTitleProps {
  item: TreeItem;
  comparison: ItemComparison;
  /** The last change's comment, once read. */
  comment?: string;
}

/** What the viewer compares, said first in its toolbar: "Your changes · vs cs:12", "Last change · cs:12 on /main by Ana · 2 days ago". */
export function ComparisonTitle({ item, comparison, comment }: ComparisonTitleProps) {
  // Under an xlink, the changeset is the xlinked repository's: no diff of the workspace's has it.
  const otherRepository = useOtherRepository(item.repository);
  if (comparison.kind === 'new') return <span className={styles.title}>{NEW_FILE_TITLES[comparison.reason]}</span>;
  if (comparison.kind === 'changes') {
    return (
      <span className={styles.comparison}>
        <span className={styles.title}>Your changes</span>
        <span className={styles.detail}>{item.changeset !== null && item.changeset > 0 ? `vs cs:${item.changeset}` : 'vs the loaded revision'}</span>
      </span>
    );
  }
  const summary = comment && firstLine(comment);
  return (
    <span className={styles.comparison}>
      <span className={styles.title}>{item.parentRevisionId > 0 ? 'Last change' : 'Added'}</span>
      <span className={styles.detail}>
        <MadeIn item={item} otherRepository={otherRepository} />
        {item.branch && ` on ${item.branch}`}
        {item.owner && ` by ${displayName(item.owner)}`}
        {item.date && (
          <>
            {' · '}
            <RelativeTime date={item.date} />
          </>
        )}
      </span>
      {summary && (
        // A one-line comment tips only when cut; a longer one always, with its other lines.
        <span className={styles.comment} data-tip={comment} data-tip-overflow={summary === comment?.trim() || undefined}>
          {summary}
        </span>
      )}
    </span>
  );
}

/** Where the revision was made: its changeset, or on a shelve the shelve (a workspace on one lists its revisions). */
function MadeIn({ item, otherRepository }: { item: TreeItem; otherRepository: string | undefined }) {
  const { changeset, shelveId, path } = item;
  if (changeset === null) {
    return (
      shelveId !== undefined && (
        <button className={styles.changeset} onClick={() => showShelveChanges({ id: shelveId }, path)} data-tip="Open the shelve's diff">
          sh:{shelveId}
        </button>
      )
    );
  }
  if (otherRepository) return <span data-tip={`Changeset ${changeset} of ${otherRepository}`}>cs:{changeset}</span>;
  return (
    <button className={styles.changeset} onClick={() => openChangesetDiff({ id: changeset }, path)} data-tip="Open the changeset's diff">
      cs:{changeset}
    </button>
  );
}
