import { Check, CircleDot, MoreHorizontal, X, type LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { CodeReview, MergeRequestInfo } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { ReferenceChip } from '../../components/comments/ReferenceChip';
import { branchWorkedOn } from '../../components/workingObject';
import type { Action } from '../../lib/actions';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { switchToBranch } from '../branches/branchOperations';
import { branchQuery } from '../branches/useBranches';
import { chooseReviewers } from './codeReviewOperations';
import { mergeCardOf, type MergeCardAction, type MergeCardSection, type MergeCardTone, type OpenItems } from './mergeCard';
import { setMergedBranchHidden, setMergeRequestState } from './mergeRequestOperations';
import { MERGE_REQUEST_STATE_ICONS } from './mergeRequestState';
import stateColors from './mergeRequestStateColors.module.css';
import styles from './MergeRequestCard.module.css';

interface MergeRequestCardProps {
  review: CodeReview;
  mergeRequest: MergeRequestInfo;
  /** The change requests and questions still open in its conversation. */
  open: OpenItems;
  /** The changeset it was merged in, from its conversation (`mergedChangesetOf`). */
  mergedChangeset: number | undefined;
}

/**
 * Where a merge request stands and what's next, after its conversation: the sections `mergeCardOf` lists, stacked,
 * then a footer with its action and its ⋯ menu. It renders whatever list of sections it's given.
 */
export function MergeRequestCard({ review, mergeRequest, open, mergedChangeset }: MergeRequestCardProps) {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const source = review.target.kind === 'branch' ? review.target.branch : undefined;
  const sourceHidden = useSourceHidden(place, mergeRequest.state === 'Merged' ? source : undefined);
  const card = mergeCardOf({
    mergeRequest,
    status: review.status,
    reviewers: review.reviewers,
    source,
    open,
    mergedChangeset,
    sourceHidden,
    workspaceBranch: branchWorkedOn(workspace?.selector),
  });

  const run = (action: MergeCardAction): void => {
    switch (action.kind) {
      case 'move':
        void setMergeRequestState(place, review, action.move);
        return;
      case 'addReviewers':
        void chooseReviewers(place, review);
        return;
      case 'setBranchHidden':
        void setMergedBranchHidden(place, action.branch, action.hidden);
        return;
      case 'switchTo':
        if (workspace) void switchToBranch(workspace.path, action.branch);
        return;
    }
  };
  // Each move is its own word: the menu keys its entries by id.
  const menu = card.menu.map((action): Action => ({ id: action.kind === 'move' ? action.move.word : action.kind, label: action.label, run: () => run(action) }));
  const menuButton = menu.length > 0 && (
    <ActionDropdownMenu entries={menu}>
      <IconButton className={styles.menu} icon={<MoreHorizontal size={15} />} label="More merge request actions" />
    </ActionDropdownMenu>
  );

  // The ⋯ ends the footer; with no footer it ends the last section, rather than a footer holding only it.
  return (
    <section className={styles.card} aria-label="Merge request">
      {card.sections.map((section, index) => (
        <CardSection key={section.id} section={section} onAction={run} trailing={!card.footer && index === card.sections.length - 1 ? menuButton : undefined} />
      ))}
      {card.footer && (
        <div className={styles.footer}>
          <Button variant={card.footer.primary ? 'primary' : 'secondary'} onClick={() => run(card.footer!)}>
            {card.footer.label}
          </Button>
          {menuButton}
        </div>
      )}
    </section>
  );
}

function CardSection({ section, onAction, trailing }: { section: MergeCardSection; onAction: (action: MergeCardAction) => void; trailing?: ReactNode }) {
  return (
    <div className={styles.section}>
      <SectionDisc section={section} />
      <div className={styles.text}>
        <p className={styles.title}>
          {section.title}
          {section.changeset !== undefined && (
            <>
              {' in '}
              <ReferenceChip reference={{ kind: 'changeset', id: section.changeset }} source={`cs:${section.changeset}`} compact />
            </>
          )}
        </p>
        {section.detail && <p className={styles.detail}>{section.detail}</p>}
        {section.rows?.map((row) => (
          <p key={row} className={styles.detail}>
            {row}
          </p>
        ))}
      </div>
      {section.action && (
        <Button size="small" className={styles.sectionAction} onClick={() => onAction(section.action!)}>
          {section.action.label}
        </Button>
      )}
      {trailing}
    </div>
  );
}

const TONE_ICONS: Record<MergeCardTone, LucideIcon> = { passed: Check, failed: X, pending: CircleDot, neutral: CircleDot };

/** The state's glyph in its color for a section that is the state; else the tone's check, cross or dot. */
function SectionDisc({ section }: { section: MergeCardSection }) {
  if (section.state) {
    const Icon = MERGE_REQUEST_STATE_ICONS[section.state];
    return (
      <span className={`${styles.disc} ${stateColors.stateColor}`} data-state={section.state}>
        <Icon size={16} aria-hidden />
      </span>
    );
  }
  const Icon = TONE_ICONS[section.tone];
  return (
    <span className={styles.disc} data-tone={section.tone}>
      <Icon size={16} aria-hidden />
    </span>
  );
}

/**
 * Whether a merged request's branch is hidden, for Hide or Unhide: the branch's own read (`branchQuery`, shared with
 * whatever else shows that branch), only for a merged request, rarely read again. None until known.
 */
function useSourceHidden(place: Place, branch: string | undefined): boolean | undefined {
  const { data } = useQuery({ ...branchQuery(place, branch ?? ''), ...SLOW_CHANGING_QUERY, enabled: branch !== undefined });
  return branch !== undefined && data !== undefined ? data?.isHidden === true : undefined;
}
