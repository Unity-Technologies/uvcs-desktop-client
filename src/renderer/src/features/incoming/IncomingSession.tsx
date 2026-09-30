import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BranchIncomingChanges } from '@shared/domain/incoming';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { ChangesetDetails } from '../changesets/ChangesetDetails';
import { changesetMenu } from '../changesets/changesetMenu';
import { fileConflictStatus, fileConflictTool } from '../merge/mergeStatus';
import { ResolveRunControl, useRunOffer } from '../merge/mergeTools/ResolveRunControl';
import { useResolveRun } from '../merge/mergeTools/useResolveRun';
import { FileConflictPanel } from '../merge/resolve/FileConflictPanel';
import { useFileConflicts } from '../merge/resolve/useFileConflicts';
import { IncomingFileDiff } from './IncomingDetail';
import { IncomingList } from './IncomingList';
import type { IncomingSelection } from './incomingRows';
import { UpdateBar } from './UpdateBar';
import { UPDATE_LABELS, updateConflictFiles, updateResolutionsOf } from './updateConflictFiles';
import { shelveBlockedAndUpdate, updateResolvingConflicts, updateToIncoming } from './updateOperations';

interface IncomingSessionProps {
  workspacePath: string;
  incoming: BranchIncomingChanges;
  header: ReactNode;
}

/** Changesets came in: what they bring, what collides with local changes, and the update that takes them. */
export function IncomingSession({ workspacePath, incoming, header }: IncomingSessionProps) {
  const conflictedFiles = useMemo(() => updateConflictFiles(incoming.conflicts), [incoming.conflicts]);
  const { states, decide, reset, resolveInTool } = useFileConflicts(workspacePath, conflictedFiles, UPDATE_LABELS);
  const [selection, setSelection] = useState<IncomingSelection | null>(null);
  // Resolving the files one by one: the selection follows while the user stays on the file it opened.
  const followRun = useCallback((key: string, previousKey: string | undefined) => {
    setSelection((current) => (!previousKey || (current?.kind === 'file' && current.path === previousKey) ? { kind: 'file', path: key } : current));
  }, []);
  const run = useResolveRun({ states, resolveInTool, onOpen: followRun, onEnd: () => undefined });
  const runPlans = useRunOffer(states, run);
  const [updating, setUpdating] = useState(false);

  const conflictPaths = useMemo(() => new Set(incoming.conflicts.map((conflict) => conflict.path)), [incoming.conflicts]);
  const blockedPaths = useMemo(() => new Set(incoming.blockedPaths), [incoming.blockedPaths]);
  const pendingConflictPaths = new Set(states.filter((state) => !state.resolution).map((state) => state.file.key));
  const conflictStates = new Map(states.map((state) => [state.file.key, { status: fileConflictStatus(state), tool: fileConflictTool(state) }]));
  const resolutions = updateResolutionsOf(states);

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
            conflictStates={conflictStates}
            blockedPaths={blockedPaths}
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
