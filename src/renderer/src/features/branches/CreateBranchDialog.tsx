import { useEffect, useState } from 'react';
import { workspacePathOf, type Place } from '@shared/domain/place';
import type { SwitchChangesAction, SwitchPreflight } from '@shared/domain/switchWithChanges';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { CommentArea } from '../../components/commentEditor/CommentArea';
import { commentPlaceholder } from '../../components/commentEditor/commentPlaceholders';
import { TextField } from '../../ui/TextField';
import { createBranchAndSwitch } from './branchOperations';
import { validateBranchName } from './branchNames';
import { PendingChangesChoice } from './PendingChangesChoice';
import { PendingChangesNotes } from './PendingChangesNotes';
import { GoToChangesButton } from './GoToChangesButton';
import { chosenStartingPoint, startingPointCards, type NewBranchOrigin } from './newBranchOrigins';
import { StartingPointPicker } from './StartingPointPicker';
import { newBranchSwitch, planSwitch, switchNotes, type SwitchPlan } from './switchOptions';
import styles from './CreateBranchDialog.module.css';

/**
 * `origins` holds one starting point, or several to choose from (the first is the default). Resolves with the new
 * branch's full name once it is created (before any switch to it), or undefined if the dialog is dismissed.
 */
export function openCreateBranchDialog(place: Place, ...origins: [NewBranchOrigin, ...NewBranchOrigin[]]): Promise<string | undefined> {
  return askDialog<string>((finish) => <CreateBranchDialog place={place} origins={origins} onFinish={finish} />);
}

interface PendingChangesState {
  preflight: SwitchPreflight;
  plan: SwitchPlan;
}

interface CreateBranchDialogProps {
  place: Place;
  origins: NewBranchOrigin[];
  /** Closes the dialog with the created branch's name, or undefined when dismissed. */
  onFinish: (created: string | undefined) => void;
}

function CreateBranchDialog({ place, origins, onFinish }: CreateBranchDialogProps) {
  const onClose = (): void => onFinish(undefined);
  const [originIndex, setOriginIndex] = useState(0);
  const origin = origins[originIndex]!;
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [topLevel, setTopLevel] = useState(false);
  const [switchAfter, setSwitchAfter] = useState(true);
  const [creating, setCreating] = useState(false);
  const workspacePath = workspacePathOf(place);
  const pending = usePendingChangesPlan(workspacePath, origin.parentBranch);
  const [action, setAction] = useState<SwitchChangesAction | null>(null);

  useEffect(() => {
    if (pending?.plan.kind === 'ask') setAction(pending.plan.choice.defaultAction);
    if (pending?.plan.kind === 'automatic') setAction(pending.plan.action);
  }, [pending]);

  const fullName = topLevel ? `/${name.trim()}` : `${origin.parentBranch}/${name.trim()}`;
  const error = name ? validateBranchName(name.trim()) : undefined;
  const { offered, question, blockedByMerge, button: submit } = newBranchSwitch(switchAfter, pending, action, workspacePath !== null);
  const startingPoints = startingPointCards(origins);

  const create = async (): Promise<void> => {
    if (!name.trim() || error) return;
    setCreating(true);
    const created = await createBranchAndSwitch(
      place,
      { name: fullName, startingPoint: origin.startingPoint, comment: comment.trim() },
      { requested: switchAfter, blockedByMerge, pendingChanges: action ?? undefined, workspaceOn: pending?.preflight.sourceName },
      () => onFinish(fullName),
    );
    if (!created) setCreating(false);
  };

  return (
    <Dialog
      title="New branch"
      description={`Starts at ${origin.startingPointLabel}.`}
      headerAction={startingPoints && <StartingPointPicker cards={startingPoints} value={originIndex} chosen={chosenStartingPoint(origin)} onChange={setOriginIndex} />}
      width={question ? 500 : undefined}
      onClose={onClose}
      onSubmit={() => void create()}
      footer={
        <>
          {question && <GoToChangesButton dismiss={onClose} />}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={submit.variant} disabled={!name.trim() || Boolean(error)} loading={creating}>
            {submit.label}
          </Button>
        </>
      }
    >
      <TextField
        label="Name"
        value={name}
        placeholder="feature-name"
        autoFocus
        error={error}
        hint={name.trim() ? `Full name: ${fullName}` : topLevel ? 'A top-level branch, like /main.' : `A child of ${origin.parentBranch}.`}
        onChange={(event) => setName(event.target.value)}
      />
      <CommentArea label="Comment" value={comment} placeholder={commentPlaceholder('What is this branch for?')} onChange={setComment} />
      <Checkbox label="Top-level branch" checked={topLevel} onChange={setTopLevel} />
      {offered && <Checkbox label="Switch the workspace to the new branch" checked={switchAfter} onChange={setSwitchAfter} />}
      {question && (
        <>
          <PendingChangesChoice
            source={question.preflight.sourceName}
            destination={name.trim() ? fullName : null}
            choice={question.choice}
            count={question.preflight.pendingCount}
            value={action}
            onChange={setAction}
            heading
          />
          <PendingChangesNotes notes={switchNotes(question.preflight, action)} />
        </>
      )}
      {blockedByMerge && <p className={styles.note}>You’re in the middle of a merge, so the workspace stays where it is. Check the merge in or undo it to switch.</p>}
    </Dialog>
  );
}

/**
 * Whether the workspace has pending changes to decide about when switching to the new branch (Bring preselected).
 * Nothing to read without a workspace.
 */
function usePendingChangesPlan(workspacePath: string | null, parentBranch: string): PendingChangesState | undefined {
  const [state, setState] = useState<PendingChangesState>();
  useEffect(() => {
    if (workspacePath === null) return;
    let current = true;
    void Promise.all([api.workspaces.switchPreflight(workspacePath, `br:${parentBranch}`), api.settings.get()])
      .then(([preflight, settings]) => current && setState({ preflight, plan: planSwitch(preflight, settings.pendingChangesOnSwitch, 'newBranch') }))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [workspacePath, parentBranch]);
  return state;
}
