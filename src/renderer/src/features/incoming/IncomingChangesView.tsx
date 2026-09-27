import { CheckCircle2, GitBranch, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IncomingChanges, UpdateResolutions } from '@shared/domain/incoming';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { SplitPane } from '../../ui/SplitPane';
import { ViewHeader } from '../../ui/ViewHeader';
import { ChangesetDetails } from '../changesets/ChangesetDetails';
import { changesetMenu } from '../changesets/changesetMenu';
import { FileConflictPanel } from '../merge/resolve/FileConflictPanel';
import { ResolveRunControl, useRunOffer } from '../merge/mergeTools/ResolveRunControl';
import { useResolveRun } from '../merge/mergeTools/useResolveRun';
import { useFileConflicts } from '../merge/resolve/useFileConflicts';
import { IncomingFileDiff } from './IncomingDetail';
import { IncomingList } from './IncomingList';
import type { IncomingSelection } from './incomingRows';
import { UpdateBar } from './UpdateBar';
import { UPDATE_LABELS, updateConflictFiles } from './updateConflictFiles';
import { shelveBlockedAndUpdate, updateResolvingConflicts, updateToIncoming } from './updateOperations';
import { useIncomingChanges } from './useIncomingChanges';

export function IncomingChangesView() {
  const workspacePath = useWorkspacePath();
  const { data: incoming, isLoading, isFetching, error } = useIncomingChanges();

  const header = (
    <ViewHeader
      title="Incoming"
      subtitle={incoming?.branch && (incoming.changesetCount > 0 ? `${incoming.changesetCount} new on ${incoming.branch}` : incoming.branch)}
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
  const { states, decide, reset, resolveInTool } = useFileConflicts(workspacePath, conflictedFiles, UPDATE_LABELS);
  const [selection, setSelection] = useState<IncomingSelection | null>(null);
  // Resolving the files one by one: the selection follows while the user stays on the file it opened.
  const followRun = useCallback((key: string, previousKey: string | undefined) => {
    setSelection((current) => (!previousKey || (current?.kind === 'file' && current.path === previousKey) ? { kind: 'file', path: key } : current));
  }, []);
  const run = useResolveRun({ states, labels: UPDATE_LABELS, resolveInTool, onOpen: followRun, onEnd: () => undefined });
  const runPlans = useRunOffer(states, run);
  const [updating, setUpdating] = useState(false);

  const conflictPaths = useMemo(() => new Set(incoming.conflicts.map((conflict) => conflict.path)), [incoming.conflicts]);
  const blockedPaths = useMemo(() => new Set(incoming.blockedPaths), [incoming.blockedPaths]);
  const pendingConflictPaths = new Set(states.filter((state) => !state.resolution).map((state) => state.file.key));
  const openToolByPath = new Map(states.flatMap((state) => (state.openTool ? [[state.file.key, state.openTool.toolName] as const] : [])));
  const resolutions = collectUpdateResolutions(states);

  // Start with the first file that needs merging, or the newest changeset.
  useEffect(() => {
    if (selection) return;
    const firstConflict = incoming.conflicts[0];
    setSelection(firstConflict ? { kind: 'file', path: firstConflict.path } : { kind: 'changeset', id: incoming.changesets[0]!.id });
  }, [selection, incoming]);

  const whileUpdating = async (work: () => Promise<unknown>): Promise<void> => {
    setUpdating(true);
    try {
      await work();
    } finally {
      setUpdating(false);
    }
  };
  const update = (): Promise<void> =>
    whileUpdating(async () => {
      if (incoming.conflicts.length === 0) await updateToIncoming(workspacePath, incoming);
      else if (resolutions) await updateResolvingConflicts(workspacePath, incoming, resolutions);
    });

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
        onShelveBlockedAndUpdate={() => void whileUpdating(() => shelveBlockedAndUpdate(workspacePath, incoming, resolutions))}
        run={run.progress || runPlans.length > 0 ? <ResolveRunControl states={states} run={run} plans={runPlans} /> : undefined}
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
            blockedPaths={blockedPaths}
            openToolByPath={openToolByPath}
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
              toolActions={{ resolveIn: (key, tool) => void resolveInTool(key, tool), run: run.progress, runOffered: runPlans.length > 0 }}
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
