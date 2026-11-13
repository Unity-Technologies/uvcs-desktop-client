import { GitCommitHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { workspacePathOf } from '@shared/domain/place';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { CommentDialog } from '../../../components/CommentDialog';
import { askDialog } from '../../../ui/dialog/dialogStore';
import { SplitButton } from '../../../ui/SplitButton';
import { applySuggestionToChanges, checkInSuggestion, type SuggestionWrite } from './applySuggestion';
import type { SuggestedChange } from './suggestedChange';
import { factsWithoutWorkspace, suggestionApplyButtonOf, suggestionApplyOf, suggestionCheckinComment, type SuggestionApply } from './suggestionApply';
import { useSuggestionApply } from './useSuggestionApply';

interface SuggestionApplyButtonProps {
  review: Pick<CodeReview, 'target'>;
  /** The change request holding the suggestion. */
  comment: ReviewComment;
  change: SuggestedChange;
  /** The request is open: a settled one offers nothing. */
  open: boolean;
}

/**
 * Applies a change request's suggestion in the window's workspace (docs/features/code-reviews.md "Applying a
 * suggestion"): Check in suggestion, or Apply to my changes behind the caret; disabled, saying why, where it can't.
 */
export function SuggestionApplyButton({ review, comment, change, open }: SuggestionApplyButtonProps) {
  const workspacePath = workspacePathOf(usePlace());
  if (!open) return null;
  if (workspacePath === null) return <ApplyButton apply={suggestionApplyOf(change, factsWithoutWorkspace(open))} />;
  return <WorkspaceApplyButton workspacePath={workspacePath} review={review} comment={comment} change={change} open={open} />;
}

function WorkspaceApplyButton({ workspacePath, review, comment, change, open }: SuggestionApplyButtonProps & { workspacePath: string }) {
  const apply = useSuggestionApply(workspacePath, review.target, change, open);
  const write = (ready: Extract<SuggestionApply, { kind: 'ready' }>): SuggestionWrite => ({ workspacePath, change, commentedText: ready.commentedText });
  return (
    <ApplyButton
      apply={apply}
      onCheckIn={async (ready) => {
        const message = await askDialog<string>((finish) => (
          <CommentDialog title="Check in suggestion" confirmLabel="Check in" original={suggestionCheckinComment(comment.author, comment.guid)} submitsUnchanged finish={finish} />
        ));
        if (message !== undefined) await checkInSuggestion(write(ready), message);
      }}
      onApply={(ready) => applySuggestionToChanges(write(ready))}
    />
  );
}

interface ApplyButtonProps {
  apply: SuggestionApply;
  onCheckIn?: (ready: Extract<SuggestionApply, { kind: 'ready' }>) => Promise<unknown>;
  onApply?: (ready: Extract<SuggestionApply, { kind: 'ready' }>) => Promise<unknown>;
}

function ApplyButton({ apply, onCheckIn, onApply }: ApplyButtonProps) {
  const [busy, setBusy] = useState(false);
  const view = suggestionApplyButtonOf(apply);
  if (!view.shown) return null;
  const run = (action: ((ready: Extract<SuggestionApply, { kind: 'ready' }>) => Promise<unknown>) | undefined): void => {
    if (apply.kind !== 'ready' || !action || busy) return;
    setBusy(true);
    void action(apply).finally(() => setBusy(false));
  };
  return (
    <SplitButton
      size="small"
      icon={<GitCommitHorizontal size={14} aria-hidden />}
      loading={busy}
      disabled={view.disabled}
      mainDisabled={view.mainDisabled}
      tip={view.tip}
      menuLabel="More ways to apply it"
      menu={[{ id: 'applyToChanges', label: 'Apply to my changes', run: () => run(onApply) }]}
      onClick={() => run(onCheckIn)}
    >
      Check in suggestion
    </SplitButton>
  );
}
