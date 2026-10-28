import { FileDiff, GitGraph, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { spec } from '@shared/domain/specs';
import { LabelChips } from '../../components/LabelChips';
import { Markdown } from '../../components/Markdown';
import { WorkspaceMark } from '../../components/WorkspaceMark';
import { withoutAction, type MenuEntry } from '../../lib/actions';
import { commentHeading } from '../../lib/comments/commentHeading';
import { commentLineText } from '../../lib/comments/commentText';
import { CommentLine } from '../../components/comments/CommentLine';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { DetailsCopyable } from '../../ui/DetailsCopyable';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { RelativeTime } from '../../ui/RelativeTime';
import { BranchChip } from '../branches/BranchChip';
import { showInBranchExplorer } from '../branchExplorer/branchExplorerStore';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { useLabelsByChangeset } from '../labels/useLabelsByChangeset';
import { changesetOf, dateOf, ownerOf, type HistoryRow } from './historyRows';
import styles from './RevisionHeader.module.css';

interface RevisionHeaderProps {
  row: HistoryRow;
  path: string;
  /** The row's context menu, behind "More actions". */
  menu: MenuEntry[];
  /** The repository of a file under an xlink, whose changesets the workspace's diffs and Branch Explorer don't have. */
  otherRepository?: string;
  isWorkspaceRevision: boolean;
}

/** The selected revision (or move) over its diff: its comment, who and when, its changeset, and where to go from it. */
export function RevisionHeader({ row, path, menu, otherRepository, isWorkspaceRevision }: RevisionHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const changesetId = changesetOf(row);
  const labels = useLabelsByChangeset(otherRepository).get(changesetId);
  const owner = ownerOf(row);
  const date = dateOf(row);
  // A revision's comment shows as a heading (`commentHeading`): one opening with code or a table shows whole, with no
  // title. A pending change's description is its title alone.
  const comment = row.kind === 'revision' ? row.revision.comment : row.change.description;
  const heading = row.kind === 'revision' ? commentHeading(comment) : null;
  const opensWithBlock = heading?.kind === 'block';
  const description = heading && heading.kind !== 'empty' ? heading.description : '';
  // The header's own buttons already offer these two.
  const moreActions = withoutAction(withoutAction(menu, 'changesetDiff'), 'showInBranchExplorer');

  return (
    <header className={styles.header}>
      <Avatar user={owner} size={28} />
      <div className={styles.main}>
        <div className={styles.titleRow}>
          {!opensWithBlock && (
            <h2 className={`${styles.title} selectable`} data-kind={row.kind} data-tip-overflow data-tip={commentLineText(comment)}>
              <CommentLine comment={comment} placeholder={<span className={styles.noComment}>No comment</span>} />
            </h2>
          )}
          <LabelChips labels={labels} />
          {isWorkspaceRevision && <WorkspaceMark on="revision" />}
          {description && !opensWithBlock && (
            <button className={styles.more} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
        {(expanded || opensWithBlock) && description && (
          <div className={`${styles.description} selectable`}>
            <Markdown text={description} comment />
          </div>
        )}
        <div className={styles.metaRow}>
          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <span className={styles.author}>{displayName(owner)}</span>
            </span>
            <span className={styles.metaItem}>
              <RelativeTime date={date} />
            </span>
            <span className={styles.metaItem}>
              <DetailsCopyable text={spec.changeset(changesetId, otherRepository)} what="Changeset spec" />
            </span>
            {row.kind === 'revision' && (
              <span className={styles.metaItem}>
                <BranchChip name={row.revision.branch} otherRepository={otherRepository} />
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        {!otherRepository && (
          <>
            <Button size="small" variant="ghost" icon={<FileDiff size={13} />} data-tip="Every file this changeset changed" onClick={() => openChangesetDiff({ id: changesetId }, path)}>
              <span data-toolbar-label>Changeset diff</span>
            </Button>
            <IconButton
              size="small"
              icon={<GitGraph size={14} />}
              label="Show in Branch Explorer"
              onClick={() => showInBranchExplorer({ kind: 'changeset', id: changesetId, date })}
            />
          </>
        )}
        {moreActions.length > 0 && (
          <ActionDropdownMenu entries={moreActions}>
            <IconButton size="small" icon={<MoreHorizontal size={15} />} label="More actions" />
          </ActionDropdownMenu>
        )}
      </div>
    </header>
  );
}
