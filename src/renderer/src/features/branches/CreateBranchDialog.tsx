import { useEffect, useState } from 'react';
import type { PendingChangesAction, SwitchPreflight } from '@shared/domain/switchWithChanges';
import { api } from '../../api/client';
import { runVoidAction } from '../../app/operations/runOperation';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { OptionCards } from '../../ui/OptionCards';
import { TextArea, TextField } from '../../ui/TextField';
import { useToastStore } from '../../ui/toast/toastStore';
import { switchToBranch } from './branchOperations';
import { validateBranchName } from './branchNames';
import { PendingChangesChoice } from './PendingChangesChoice';
import { planSwitch, type SwitchPlan } from './switchOptions';
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

/** `origins` holds one starting point, or several to choose from (the first is the default). */
export function openCreateBranchDialog(workspacePath: string, ...origins: [NewBranchOrigin, ...NewBranchOrigin[]]): void {
  openDialog((close) => <CreateBranchDialog workspacePath={workspacePath} origins={origins} onClose={close} />);
}

interface PendingChangesState {
  preflight: SwitchPreflight;
  plan: SwitchPlan;
}

function CreateBranchDialog({ workspacePath, origins, onClose }: { workspacePath: string; origins: NewBranchOrigin[]; onClose: () => void }) {
  const [originIndex, setOriginIndex] = useState(0);
  const origin = origins[originIndex]!;
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [topLevel, setTopLevel] = useState(false);
  const [switchAfter, setSwitchAfter] = useState(true);
  const [creating, setCreating] = useState(false);
  const pending = usePendingChangesPlan(workspacePath, origin.parentBranch);
  const [action, setAction] = useState<PendingChangesAction | null>(null);

  useEffect(() => {
    if (pending?.plan.kind === 'ask') setAction(pending.plan.choice.defaultAction);
    if (pending?.plan.kind === 'automatic') setAction(pending.plan.action);
  }, [pending]);

  const fullName = topLevel ? `/${name.trim()}` : `${origin.parentBranch}/${name.trim()}`;
  const error = name ? validateBranchName(name.trim()) : undefined;
  const blockedByMerge = switchAfter && pending?.plan.kind === 'blockedByMerge';

  const create = async (): Promise<void> => {
    if (!name.trim() || error) return;
    setCreating(true);
    const created = await runVoidAction(workspacePath, "Couldn't create the branch", () =>
      api.branches.create(workspacePath, { name: fullName, startingPoint: origin.startingPoint, comment }),
    );
    setCreating(false);
    if (!created) return;

    onClose();
    if (!switchAfter) return;
    const switched = !blockedByMerge && (await switchToBranch(workspacePath, fullName, action ?? undefined));
    if (!switched) announceNotSwitched(workspacePath, fullName, pending?.preflight.sourceName);
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
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || Boolean(error)} loading={creating}>
            Create branch
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
      {switchAfter && pending?.plan.kind === 'ask' && (
        <PendingChangesChoice
          source={pending.preflight.sourceName}
          destination={name.trim() ? fullName : 'the new branch'}
          choice={pending.plan.choice}
          value={action}
          onChange={setAction}
          heading
        />
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
      .then(([preflight, settings]) => current && setState({ preflight, plan: planSwitch(preflight, settings.pendingChangesOnSwitch, 'bring') }))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [workspacePath, parentBranch]);
  return state;
}

function announceNotSwitched(workspacePath: string, branch: string, sourceName: string | undefined): void {
  useToastStore.getState().show({
    kind: 'info',
    title: `Created ${branch} — you're still on ${sourceName ?? 'the same branch'}`,
    action: { label: 'Switch', run: () => void switchToBranch(workspacePath, branch) },
  });
}
