import { useEffect, useState } from 'react';
import type { SwitchChangesAction, SwitchPreflight } from '@shared/domain/switchWithChanges';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { OptionCards } from '../../ui/OptionCards';
import { TextArea, TextField } from '../../ui/TextField';
import { createBranchAndSwitch } from './branchOperations';
import { validateBranchName } from './branchNames';
import { PendingChangesChoice } from './PendingChangesChoice';
import { PendingChangesNotes } from './PendingChangesNotes';
import { ReviewChangesButton } from './ReviewChangesButton';
import { newBranchSwitch, planSwitch, switchNotes, type SwitchPlan } from './switchOptions';
import styles from './CreateBranchDialog.module.css';

export interface NewBranchOrigin {
  /** The branch the new one hangs from, e.g. `/main`. */
  parentBranch: string;
  /** Where it starts: `cs:12` or `lb:v1`. */
  startingPoint: string;
  /** How to describe the starting point to the user, e.g. "changeset 12". */
  startingPointLabel: string;
  /** How it reads as one of several "Start from" cards. */
  card?: { title: string; description: string };
}

/**
 * `origins` holds one starting point, or several to choose from (the first is the default). Resolves with the new
 * branch's full name once it is created (before any switch to it), or undefined if the dialog is dismissed.
 */
export function openCreateBranchDialog(workspacePath: string, ...origins: [NewBranchOrigin, ...NewBranchOrigin[]]): Promise<string | undefined> {
  return askDialog<string>((finish) => <CreateBranchDialog workspacePath={workspacePath} origins={origins} onFinish={finish} />);
}

interface PendingChangesState {
  preflight: SwitchPreflight;
  plan: SwitchPlan;
}

interface CreateBranchDialogProps {
  workspacePath: string;
  origins: NewBranchOrigin[];
  /** Closes the dialog with the created branch's name, or undefined when dismissed. */
  onFinish: (created: string | undefined) => void;
}

function CreateBranchDialog({ workspacePath, origins, onFinish }: CreateBranchDialogProps) {
  const onClose = (): void => onFinish(undefined);
  const [originIndex, setOriginIndex] = useState(0);
  const origin = origins[originIndex]!;
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [topLevel, setTopLevel] = useState(false);
  const [switchAfter, setSwitchAfter] = useState(true);
  const [creating, setCreating] = useState(false);
  const pending = usePendingChangesPlan(workspacePath, origin.parentBranch);
  const [action, setAction] = useState<SwitchChangesAction | null>(null);

  useEffect(() => {
    if (pending?.plan.kind === 'ask') setAction(pending.plan.choice.defaultAction);
    if (pending?.plan.kind === 'automatic') setAction(pending.plan.action);
  }, [pending]);

  const fullName = topLevel ? `/${name.trim()}` : `${origin.parentBranch}/${name.trim()}`;
  const error = name ? validateBranchName(name.trim()) : undefined;
  const { question, blockedByMerge, button: submit } = newBranchSwitch(switchAfter, pending, action);

  const create = async (): Promise<void> => {
    if (!name.trim() || error) return;
    setCreating(true);
    const created = await createBranchAndSwitch(
      workspacePath,
      { name: fullName, startingPoint: origin.startingPoint, comment },
      { requested: switchAfter, blockedByMerge, pendingChanges: action ?? undefined, workspaceOn: pending?.preflight.sourceName },
      () => onFinish(fullName),
    );
    if (!created) setCreating(false);
  };

  return (
    <Dialog
      title="New branch"
      description={origins.length === 1 ? `Starts at ${origin.startingPointLabel}.` : undefined}
      width={origins.length > 1 || pending?.plan.kind === 'ask' ? 500 : undefined}
      onClose={onClose}
      onSubmit={() => void create()}
      footer={
        <>
          {question && <ReviewChangesButton dismiss={onClose} />}
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
      {origins.length > 1 && (
        <OptionCards
          label="Start from"
          heading
          layout="list"
          cards={origins.map((candidate, index) => ({
            value: String(index),
            title: candidate.card?.title ?? candidate.startingPointLabel,
            description: candidate.card?.description ?? '',
          }))}
          value={String(originIndex)}
          onChange={(value) => setOriginIndex(Number(value))}
        />
      )}
      <TextArea label="Comment" value={comment} placeholder="What is this branch for?" onChange={(event) => setComment(event.target.value)} />
      <Checkbox label="Top-level branch" checked={topLevel} onChange={setTopLevel} />
      <Checkbox label="Switch the workspace to the new branch" checked={switchAfter} onChange={setSwitchAfter} />
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

/** Whether the workspace has pending changes to decide about when switching to the new branch (Bring preselected). */
function usePendingChangesPlan(workspacePath: string, parentBranch: string): PendingChangesState | undefined {
  const [state, setState] = useState<PendingChangesState>();
  useEffect(() => {
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
