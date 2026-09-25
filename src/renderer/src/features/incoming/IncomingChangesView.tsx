import { CheckCircle2, GitBranch, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { IncomingChanges, UpdateResolutions } from '@shared/domain/incoming';
import { invalidateWorkspace } from '../../app/queryClient';
import { updateWorkspace } from '../../app/shell/workspaceOperations';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { SplitPane } from '../../ui/SplitPane';
import { ViewHeader } from '../../ui/ViewHeader';
import { ChangesetDetails } from '../changesets/ChangesetDetails';
import { changesetMenu } from '../changesets/changesetMenu';
import { FileConflictPanel } from '../merge/resolve/FileConflictPanel';
import { useFileConflicts } from '../merge/resolve/useFileConflicts';
import { IncomingFileDiff } from './IncomingDetail';
import { IncomingList, type IncomingSelection } from './IncomingList';
import { UpdateBar } from './UpdateBar';
import { UPDATE_LABELS, updateConflictFiles } from './updateConflictFiles';
import { updateResolvingConflicts } from './updateOperations';
import { useIncomingChanges } from './useIncomingChanges';

export function IncomingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: incoming, isLoading, isFetching, error } = useIncomingChanges();

  const header = (
    <ViewHeader
      title="Incoming"
      subtitle={incoming?.branch && `${incoming.changesetCount} new on ${incoming.branch}`}
      actions={<IconButton icon={<RefreshCw size={14} />} label="Refresh" loading={isFetching} onClick={() => void invalidateWorkspace(workspacePath)} />}
    />
  );

  if (isLoading) return <>{header}<CenteredSpinner /></>;
  if (error || !incoming) return <>{header}<EmptyState title="Couldn't check for incoming changes" description={error?.message} /></>;

  if (!incoming.branch) {
    return (
      <>
        {header}
        <EmptyState icon={<GitBranch size={22} />} title="Not on a branch" description="The workspace is loaded from a fixed point in history, so nothing new comes in." />
      </>
    );
  }

  if (incoming.changesetCount === 0) {
    return (
      <>
        {header}
        <EmptyState icon={<CheckCircle2 size={22} />} title="You're up to date" description={`Your workspace has everything on ${incoming.branch}.`} />
      </>
    );
  }

  return <IncomingSession key={incoming.headChangeset} workspacePath={workspacePath} incoming={incoming} header={header} />;
}

interface IncomingSessionProps {
  workspacePath: string;
  incoming: IncomingChanges;
  header: React.ReactNode;
}

function IncomingSession({ workspacePath, incoming, header }: IncomingSessionProps) {
  const conflictedFiles = useMemo(() => updateConflictFiles(incoming.conflicts), [incoming.conflicts]);
  const { states, decide, reset } = useFileConflicts(workspacePath, conflictedFiles, UPDATE_LABELS);
  const [selection, setSelection] = useState<IncomingSelection | null>(null);
  const [updating, setUpdating] = useState(false);

  const conflictPaths = useMemo(() => new Set(incoming.conflicts.map((conflict) => conflict.path)), [incoming.conflicts]);
  const pendingConflictPaths = new Set(states.filter((state) => !state.resolution).map((state) => state.file.key));
  const resolutions = collectUpdateResolutions(states);

  // Start with the first file that needs merging, or the newest changeset.
  useEffect(() => {
    if (selection) return;
    const firstConflict = incoming.conflicts[0];
    setSelection(firstConflict ? { kind: 'file', path: firstConflict.path } : { kind: 'changeset', id: incoming.changesets[0]!.id });
  }, [selection, incoming]);

  const update = async (): Promise<void> => {
    setUpdating(true);
    if (incoming.conflicts.length === 0) await updateWorkspace(workspacePath);
    else if (resolutions) await updateResolvingConflicts(workspacePath, resolutions);
    setUpdating(false);
  };

  const selectedChangeset = selection?.kind === 'changeset' ? incoming.changesets.find((changeset) => changeset.id === selection.id) : undefined;
  const selectedFile = selection?.kind === 'file' ? incoming.files.find((file) => file.path === selection.path) : undefined;
  const selectedConflict = selectedFile && states.find((state) => state.file.key === selectedFile.path);

  return (
    <>
      {header}
      <UpdateBar
        incoming={incoming}
        pendingConflictCount={pendingConflictPaths.size}
        canUpdate={incoming.conflicts.length === 0 || Boolean(resolutions)}
        updating={updating}
        onUpdate={() => void update()}
      />
      <SplitPane
        initialSize={360}
        minSize={240}
        maxSize={640}
        first={
          <IncomingList
            changesets={incoming.changesets}
            files={incoming.files}
            conflictPaths={conflictPaths}
            pendingConflictPaths={pendingConflictPaths}
            selection={selection}
            onSelect={setSelection}
          />
        }
        second={
          selectedConflict ? (
            <FileConflictPanel
              key={selectedConflict.file.key}
              workspacePath={workspacePath}
              state={selectedConflict}
              labels={UPDATE_LABELS}
              onDecide={(decision) => decide(selectedConflict.file.key, decision)}
              onStartOver={() => reset(selectedConflict.file.key)}
            />
          ) : selectedFile ? (
            <IncomingFileDiff workspacePath={workspacePath} file={selectedFile} />
          ) : selectedChangeset ? (
            <ChangesetDetails
              key={selectedChangeset.id}
              changeset={selectedChangeset}
              menu={changesetMenu({ workspacePath, loadedChangeset: incoming.loadedChangeset, loadedBranch: incoming.branch ?? undefined }, [selectedChangeset])}
            />
          ) : (
            <EmptyState title="Select a changeset or a file" />
          )
        }
      />
    </>
  );
}

function collectUpdateResolutions(states: ReturnType<typeof useFileConflicts>['states']): UpdateResolutions | null {
  const resolutions: UpdateResolutions = {};
  for (const state of states) {
    if (!state.resolution) return null;
    resolutions[state.file.key] = state.resolution;
  }
  return resolutions;
}
