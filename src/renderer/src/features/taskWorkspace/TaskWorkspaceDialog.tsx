import { useQuery } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { NewFolderCheck } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { LocationField } from '../../app/home/dialogs/LocationField';
import { describeProgress } from '../../app/operations/describeProgress';
import { nextProgressBar, SWEEP } from '../../app/operations/progressBar';
import { invalidateWorkspace, queryClient } from '../../app/queryClient';
import { isAffectedByNewBranch } from '../../app/refresh/refreshScopes';
import { useOpenWorkspace } from '../../app/workspace/useOpenWorkspace';
import { useWorkspaceInfoOf } from '../../app/workspace/useWorkspace';
import { useWorkspaceList } from '../../app/workspace/workspaceQueries';
import { lastSegment } from '../../lib/paths';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TextField } from '../../ui/TextField';
import { validateBranchName } from '../branches/branchNames';
import { pickBranch } from '../branches/BranchPickerDialog';
import { describeTaskFailure, setUpTaskWorkspace, taskSteps, type TaskStep, type TaskStepState, type TaskWorkspacePlan } from './setUpTaskWorkspace';
import { taskWorkspaceActions } from './taskWorkspaceActions';
import { defaultTaskFolder, suggestTaskBranchName, TASK_PARENT_BRANCH, taskWorkspaceName } from './taskWorkspaceNaming';
import { TaskStepList, type TaskStepProgress } from './TaskStepList';
import { useBranchExists } from './useBranchExists';
import styles from './TaskWorkspaceDialog.module.css';

interface TaskWorkspaceOptions {
  /** The workspace it's opened from: the new one works on the same repository and goes next to it. */
  workspacePath: string;
  /** Work on this existing branch instead of a new one. */
  branch?: string;
}

/** Opens "New workspace for a task": a branch, a folder for its own workspace, and a window to work in it. */
export function openTaskWorkspaceDialog(options: TaskWorkspaceOptions): void {
  openDialog((close) => <TaskWorkspaceDialog {...options} onClose={close} />);
}

type BranchMode = 'new' | 'existing';

const FOLDER_PROBLEMS: Record<Exclude<NewFolderCheck, 'available'>, string> = {
  notEmpty: 'This folder isn’t empty. Choose a new or empty folder.',
  notAFolder: 'There’s a file at this path.',
};

function TaskWorkspaceDialog({ workspacePath, branch: initialBranch, onClose }: TaskWorkspaceOptions & { onClose: () => void }) {
  const { data: workspace } = useWorkspaceInfoOf(workspacePath);
  const { data: workspaces } = useWorkspaceList();
  const openWorkspace = useOpenWorkspace();

  const [mode, setMode] = useState<BranchMode>(initialBranch ? 'existing' : 'new');
  const [leaf, setLeaf] = useState(() => suggestTaskBranchName(new Date()));
  const [existingBranch, setExistingBranch] = useState(initialBranch);
  const [chosenFolder, setChosenFolder] = useState<string>();
  const [newWindow, setNewWindow] = useState(true);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [states, setStates] = useState<Partial<Record<TaskStep, TaskStepState>>>({});
  const [labels, setLabels] = useState<Record<TaskStep, string>>();
  const [switchProgress, setSwitchProgress] = useState<TaskStepProgress | null>(null);
  const [failure, setFailure] = useState<{ message: string; reason: string } | null>(null);
  const operationId = useRef<string | null>(null);

  const branchError = mode === 'new' ? validateBranchName(leaf.trim()) : undefined;
  const branch = mode === 'new' ? `${TASK_PARENT_BRANCH}/${leaf.trim()}` : existingBranch;
  // A new branch whose name is taken is simply worked on, as if picked under "Existing branch".
  const typedExists = useBranchExists(workspacePath, mode === 'new' && !branchError && !running ? branch : undefined);
  const folder = chosenFolder ?? (workspace && branch ? defaultTaskFolder(workspacePath, workspace.repositoryName, branch) : '');
  const name = useMemo(() => (folder ? taskWorkspaceName(folder, (workspaces ?? []).map((candidate) => candidate.name)) : ''), [folder, workspaces]);
  const { data: folderCheck } = useQuery({
    queryKey: ['newWorkspaceFolder', folder],
    queryFn: () => api.workspaces.checkNewFolder(folder),
    enabled: Boolean(folder) && !running,
    staleTime: 0,
    gcTime: 0,
  });
  const folderProblem = folderCheck && folderCheck !== 'available' ? FOLDER_PROBLEMS[folderCheck] : undefined;
  const plan: TaskWorkspacePlan | null =
    workspace && branch && !branchError && folder && name && folderCheck === 'available' && (mode === 'existing' || running || typedExists !== undefined)
      ? { repository: workspace.repository, branch, newBranch: mode === 'new' && !typedExists, workspaceName: name, folder }
      : null;

  const chooseBranch = async (): Promise<void> => {
    const picked = await pickBranch({ title: 'Work on a branch', description: 'The new workspace switches to it.' });
    if (picked) setExistingBranch(picked);
  };

  const chooseFolder = async (): Promise<void> => {
    const picked = await api.system.pickDirectory('Choose the folder for the new workspace', folder || undefined);
    if (picked) setChosenFolder(picked);
  };

  const create = async (): Promise<void> => {
    if (!plan || running) return;
    setRunning(true);
    setFailure(null);
    setSteps(taskSteps(plan.newBranch));
    setLabels({ branch: `Create branch ${plan.branch}`, workspace: `Create workspace ${plan.workspaceName}`, switch: `Switch it to ${plan.branch}` });
    setStates({});
    setSwitchProgress(null);
    operationId.current = crypto.randomUUID();
    const actions = taskWorkspaceActions(workspacePath, operationId.current, (progress) =>
      setSwitchProgress((previous) => ({ text: describeProgress(progress), bar: nextProgressBar(previous?.bar ?? SWEEP, progress, performance.now()) })),
    );
    const outcome = await setUpTaskWorkspace(plan, actions, (step, state) => setStates((current) => ({ ...current, [step]: state })));
    operationId.current = null;
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
    if (plan.newBranch) void invalidateWorkspace(workspacePath, isAffectedByNewBranch);
    setRunning(false);

    if (outcome.kind === 'failed') {
      setFailure({ message: describeTaskFailure(outcome), reason: outcome.error instanceof Error ? outcome.error.message : String(outcome.error) });
      // Trying again works on the branch that was just created.
      if (outcome.keptBranch) {
        setMode('existing');
        setExistingBranch(outcome.keptBranch);
      }
      return;
    }
    onClose();
    if (newWindow) void api.windows.openWorkspace(outcome.workspacePath);
    else openWorkspace(outcome.workspacePath);
  };

  // While it runs, closing stops the switch (the workspace is then removed); the other steps are quick.
  const close = (): void => {
    if (!running) onClose();
    else if (operationId.current && states.switch === 'running') void api.system.cancelOperation(operationId.current);
  };

  return (
    <Dialog
      title="New workspace for a task"
      description="Its own folder and branch, so you (or an agent) can work there while this workspace stays as it is."
      width={560}
      onClose={close}
      onSubmit={() => void create()}
      footer={
        <>
          <Button onClick={close} disabled={running && states.switch !== 'running'}>
            {running ? 'Stop' : 'Cancel'}
          </Button>
          <Button type="submit" variant="primary" disabled={!plan} loading={running}>
            Create workspace
          </Button>
        </>
      }
    >
      <div className={styles.branchField}>
        <span className={styles.label}>Branch</span>
        <SegmentedControl<BranchMode>
          value={mode}
          onChange={setMode}
          segments={[
            { value: 'new', label: `New child of ${TASK_PARENT_BRANCH}` },
            { value: 'existing', label: 'Existing branch' },
          ]}
        />
        {mode === 'new' ? (
          <TextField
            aria-label="Branch name"
            value={leaf}
            disabled={running}
            autoFocus
            error={leaf ? branchError : undefined}
            hint={
              typedExists
                ? `${branch} already exists: the new workspace works on it.`
                : `${TASK_PARENT_BRANCH}/${leaf.trim() || '…'}, starting at the latest changeset of ${TASK_PARENT_BRANCH}.`
            }
            onChange={(event) => setLeaf(event.target.value)}
          />
        ) : (
          <Button className={styles.branchButton} icon={<GitBranch size={14} />} disabled={running} onClick={() => void chooseBranch()}>
            {existingBranch ?? 'Choose a branch…'}
          </Button>
        )}
      </div>

      <div className={styles.folderField}>
        <LocationField label="Folder" path={folder} disabled={running} onChange={setChosenFolder} onChoose={() => void chooseFolder()} />
        {folderProblem ? (
          <span className={styles.error}>{folderProblem}</span>
        ) : (
          name && <span className={styles.hint}>Workspace {name}{name !== lastSegment(folder) && ', as the folder’s name is taken by another workspace'}.</span>
        )}
      </div>

      <Checkbox label="Open in a new window" checked={newWindow} onChange={setNewWindow} disabled={running} />

      {labels && <TaskStepList steps={steps} states={states} labels={labels} progress={switchProgress} />}
      {failure && (
        <div className={styles.failure} role="alert">
          <p>{failure.message}</p>
          <p className={styles.reason}>{failure.reason}</p>
        </div>
      )}
    </Dialog>
  );
}
