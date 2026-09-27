import { useId, useState } from 'react';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction } from '../../app/operations/runOperation';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TextField } from '../../ui/TextField';
import { toast } from '../../ui/toast/toastStore';
import { useBranches } from '../branches/useBranches';

export type ReviewTargetKind = 'branch' | 'changeset' | 'shelve';

export interface ReviewTargetDraft {
  kind: ReviewTargetKind;
  /** Branch name (e.g. `/main/task`), changeset or shelve number. */
  value: string;
  /** A title to start from, e.g. the shelve's comment. */
  title?: string;
}

const SPEC_PREFIX: Record<ReviewTargetKind, string> = { branch: 'br', changeset: 'cs', shelve: 'sh' };

/**
 * Opens the "new code review" dialog. Other features can prefill the target,
 * e.g. from a branch, changeset or shelve context menu.
 */
export function openCreateCodeReviewDialog(workspacePath: string, initialTarget: ReviewTargetDraft, onCreated?: (reviewId: number) => void): void {
  openDialog((close) => <CreateCodeReviewDialog workspacePath={workspacePath} initialTarget={initialTarget} onClose={close} onCreated={onCreated} />);
}

interface CreateCodeReviewDialogProps {
  workspacePath: string;
  initialTarget: ReviewTargetDraft;
  onClose: () => void;
  onCreated?: (reviewId: number) => void;
}

function CreateCodeReviewDialog({ workspacePath, initialTarget, onClose, onCreated }: CreateCodeReviewDialogProps) {
  const branchListId = useId();
  const { data: branches } = useBranches();
  const [targetKind, setTargetKind] = useState<ReviewTargetKind>(initialTarget.kind);
  const [target, setTarget] = useState(initialTarget.value);
  const [title, setTitle] = useState(initialTarget.title ?? '');
  const [assignee, setAssignee] = useState('');
  const [creating, setCreating] = useState(false);

  const targetSpec = `${SPEC_PREFIX[targetKind]}:${target.trim()}`;
  const isValid = title.trim() !== '' && (targetKind === 'branch' ? target.trim().startsWith('/') : /^\d+$/.test(target.trim()));

  const create = async (): Promise<void> => {
    if (!isValid) return;
    setCreating(true);
    const reviewId = await runAction(workspacePath, "Couldn't create the code review", () =>
      api.codeReviews.create(workspacePath, { targetSpec, title: title.trim(), assignee: assignee.trim() || undefined }),
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
            {branches?.map((branch) => <option key={branch.id} value={branch.name} />)}
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
      <TextField label="Title" placeholder="What should be reviewed?" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
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
