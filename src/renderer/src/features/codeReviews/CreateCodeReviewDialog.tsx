import { useId, useMemo, useState } from 'react';
import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction } from '../../app/operations/runOperation';
import { isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { CommentArea } from '../../components/commentEditor/CommentArea';
import { oneLineText } from '../../components/commentEditor/commentFieldText';
import { TextField } from '../../ui/TextField';
import { toast } from '../../ui/toast/toastStore';
import { useBranches } from '../branches/useBranches';
import { branchSuggestions } from './branchSuggestions';
import { draftTargetSpec, type ReviewTargetDraft, type ReviewTargetKind } from './reviewDraft';

/**
 * Opens the "new code review" dialog. Other features can prefill the target,
 * e.g. from a branch, changeset or shelve context menu.
 */
export function openCreateCodeReviewDialog(place: Place, initialTarget: ReviewTargetDraft, onCreated?: (reviewId: number) => void): void {
  openDialog((close) => <CreateCodeReviewDialog place={place} initialTarget={initialTarget} onClose={close} onCreated={onCreated} />);
}

interface CreateCodeReviewDialogProps {
  place: Place;
  initialTarget: ReviewTargetDraft;
  onClose: () => void;
  onCreated?: (reviewId: number) => void;
}

function CreateCodeReviewDialog({ place, initialTarget, onClose, onCreated }: CreateCodeReviewDialogProps) {
  const branchListId = useId();
  const { data: branches } = useBranches();
  const [targetKind, setTargetKind] = useState<ReviewTargetKind>(initialTarget.kind);
  const [target, setTarget] = useState(initialTarget.value);
  const [title, setTitle] = useState(initialTarget.title ?? '');
  const [assignee, setAssignee] = useState('');
  const [creating, setCreating] = useState(false);

  // Only the best few of the tens of thousands a repository may hold: suggesting every one made the field slow to
  // open and to type in.
  const suggestions = useMemo(() => (targetKind === 'branch' && branches ? branchSuggestions(branches, target) : []), [targetKind, branches, target]);
  const targetSpec = draftTargetSpec(targetKind, target);
  const isValid = title.trim() !== '' && targetSpec !== null;

  const create = async (): Promise<void> => {
    if (!isValid) return;
    setCreating(true);
    const reviewId = await runAction(
      place,
      "Couldn't create the code review",
      () => api.codeReviews.create(place, { targetSpec, title: title.trim(), assignee: assignee.trim() || undefined }),
      isAffectedByCodeReviews,
    );
    setCreating(false);
    if (reviewId === undefined) return;

    onClose();
    onCreated?.(reviewId);
    toast.success(`Created code review ${reviewId}`, undefined, {
      label: 'Open',
      run: () => navigation.openPage({ kind: 'codeReview', reviewId }),
    });
  };

  return (
    <Dialog
      title="New code review"
      description="Ask a teammate to review a branch, a changeset or a shelve."
      width={500}
      onClose={onClose}
      onSubmit={() => void create()}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!isValid} loading={creating}>
            Create review
          </Button>
        </>
      }
    >
      <SegmentedControl<ReviewTargetKind>
        stretch
        value={targetKind}
        onChange={(kind) => {
          setTargetKind(kind);
          setTarget('');
        }}
        segments={[
          { value: 'branch', label: 'Branch' },
          { value: 'changeset', label: 'Changeset' },
          { value: 'shelve', label: 'Shelve' },
        ]}
      />
      {targetKind === 'branch' ? (
        <>
          <TextField label="Branch" placeholder="/main/task" value={target} onChange={(event) => setTarget(event.target.value)} list={branchListId} />
          <datalist id={branchListId}>
            {suggestions.map((branch) => <option key={branch.id} value={branch.name} />)}
          </datalist>
        </>
      ) : (
        <TextField
          label={targetKind === 'changeset' ? 'Changeset' : 'Shelve'}
          placeholder={targetKind === 'changeset' ? '42' : '7'}
          inputMode="numeric"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        />
      )}
      {/* A title is one line: Enter creates the review, as the field it replaced did. */}
      <CommentArea singleLine label="Title" placeholder="What should be reviewed?" value={title} onChange={(text) => setTitle(oneLineText(text))} autoFocus />
      <TextField
        label="Reviewer"
        placeholder="jane.doe@example.com"
        hint="Optional. You can assign it later."
        value={assignee}
        onChange={(event) => setAssignee(event.target.value)}
      />
    </Dialog>
  );
}
