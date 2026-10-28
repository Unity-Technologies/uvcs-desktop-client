import { Folder } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { workspacePlace } from '@shared/domain/place';
import type { DiffEntry } from '@shared/domain/diff';
import type { BranchIncomingChanges } from '@shared/domain/incoming';
import { useShowInFollowingWindow } from '../../app/pageWindow/useShowInFollowingWindow';
import { isHeaderRow } from '../../lib/groupedPathTree';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { pluralize } from '../../lib/text';
import { hidesEveryRow } from '../../lib/hidesEveryRow';
import { EmptyState } from '../../ui/EmptyState';
import { NoMatches } from '../../ui/NoMatches';
import { ChangesetDetails } from '../changesets/ChangesetDetails';
import { changesetMenu } from '../changesets/changesetMenu';
import { changesetDiffPage } from '../changesets/changesetOperations';
import { diffEntryKey } from '../diff/DiffEntryList';
import { FileStepsContext, useFileSteps } from '../diff/viewer/fileSteps';
import { conflictStepKeys } from '../merge/conflictSteps';
import { fileConflictStatus, fileConflictTool } from '../merge/mergeStatus';
import { ResolveRunControl, useRunOffer } from '../merge/mergeTools/ResolveRunControl';
import { useResolveRun } from '../merge/mergeTools/useResolveRun';
import { useFileMergers } from '../merge/mergeTools/useMergeTools';
import { FileConflictPanel } from '../merge/resolve/FileConflictPanel';
import { useFileConflicts } from '../merge/resolve/useFileConflicts';
import { IncomingChangesetList } from './IncomingChangesetList';
import { IncomingConflictMark } from './IncomingConflictMark';
import { IncomingFileDiff } from './IncomingDetail';
import { incomingFileMenu } from './incomingFileMenu';
import { incomingSubtitle } from './incomingSubtitle';
import { ALL_INCOMING, collidesWithLocal, firstIncomingFile, incomingFilesSummary, type IncomingScope } from './incomingScope';
import { IncomingFiles } from './IncomingFiles';
import { IncomingPanes } from './IncomingPanes';
import { UpdateBar } from './UpdateBar';
import { useIncomingChangesetList } from './useIncomingChangesets';
import { UPDATE_LABELS, updateConflictFiles, updateResolutionsOf } from './updateConflictFiles';
import { shelveBlockedAndUpdate, updateResolvingConflicts, updateToIncoming } from './updateOperations';
import { useIncomingFiles } from './useIncomingFiles';
import { useIncomingViewStore } from './incomingViewStore';

interface IncomingSessionProps {
  workspacePath: string;
  incoming: BranchIncomingChanges;
  /** The view's header, saying the words given (`incomingSubtitle`). */
  header: (subtitle: string) => ReactNode;
}

/**
 * Changesets came in: what they bring, all of it or one changeset's, what collides with local changes, and the update
 * that takes them. A changeset selected shows its details, as in History, and its files in the list.
 */
export function IncomingSession({ workspacePath, incoming, header }: IncomingSessionProps) {
  const conflictedFiles = useMemo(() => updateConflictFiles(incoming.conflicts), [incoming.conflicts]);
  const { states, decide, reset, resolveInTool, openFile } = useFileConflicts(workspacePath, conflictedFiles, UPDATE_LABELS);
  const [scope, setScope] = useState<IncomingScope>(ALL_INCOMING);
  // The right-hand side shows the changeset just picked, until a file is.
  const [showsChangeset, setShowsChangeset] = useState(false);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const { changesetsCollapsed, toggleChangesets } = useIncomingViewStore();
  const changesetList = useIncomingChangesetList(incoming);
  const { mergerFor, othersFor } = useFileMergers();

  const conflictPaths = useMemo(() => new Set(incoming.conflicts.map((conflict) => conflict.path)), [incoming.conflicts]);
  const blockedPaths = useMemo(() => new Set(incoming.blockedPaths), [incoming.blockedPaths]);
  const collides = useCallback((file: DiffEntry) => collidesWithLocal(file, conflictPaths, blockedPaths), [conflictPaths, blockedPaths]);
  const { files, filter, rows, tree, toggleCollapsed: toggleFolder } = useIncomingFiles(scope, incoming.files, collides, selection.anchor);

  // Resolving the files one by one: the selection follows while the user stays on the file it opened.
  const followRun = useCallback((key: string, previousKey: string | undefined) => {
    if (previousKey && selectionRef.current.anchor !== previousKey) return;
    setScope(ALL_INCOMING);
    setShowsChangeset(false);
    setSelection(singleSelection(key));
  }, []);
  const run = useResolveRun({ states, mergerFor, resolveInTool, onOpen: followRun, onEnd: () => undefined });
  const runPlans = useRunOffer(states, run);
  const [updating, setUpdating] = useState(false);

  const pendingConflictPaths = useMemo(() => new Set(states.filter((state) => !state.resolution).map((state) => state.file.key)), [states]);
  // A conflicting file's arrows go on past its first or last conflict to the files around it that need merging.
  const conflictKeys = useMemo(
    () => conflictStepKeys(rows, selection.anchor, (file: DiffEntry) => pendingConflictPaths.has(file.path)),
    [rows, selection.anchor, pendingConflictPaths],
  );
  const conflictSteps = useFileSteps({
    keys: conflictKeys,
    current: selection.anchor,
    select: (key) => selectFiles(singleSelection(key)),
    pathOf: (key) => key,
  });
  const conflictStates = new Map(states.map((state) => [state.file.key, { status: fileConflictStatus(state), tool: fileConflictTool(state) }]));
  const resolutions = updateResolutionsOf(states);

  const focusedFile = files?.find((file) => diffEntryKey(file) === selection.anchor);
  // Nothing to select while the filters hide every file: the detail pane shows no file.
  const hidesAll = hidesEveryRow(files?.length ?? 0, filter.visible.length);
  const focusedGroup = focusedFile ? undefined : rows.filter(isHeaderRow).find((row) => row.key === selection.anchor);
  const firstFile = files && scope.kind === 'all' ? firstIncomingFile(files, collides) : undefined;

  // The whole update opens on the first file that needs merging, or the first file.
  useEffect(() => {
    if (!showsChangeset && !focusedFile && !focusedGroup && firstFile) setSelection(singleSelection(diffEntryKey(firstFile)));
  }, [showsChangeset, focusedFile, focusedGroup, firstFile]);

  const changeScope = (next: IncomingScope): void => {
    setScope(next);
    setShowsChangeset(next.kind === 'changeset');
    setSelection(EMPTY_SELECTION);
  };
  const selectFiles = (next: SelectionState): void => {
    setSelection(next);
    setShowsChangeset(false);
  };

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

  const menuContext = { place: workspacePlace(workspacePath), loadedChangeset: incoming.loadedChangeset, loadedBranch: incoming.branch ?? undefined };
  const scopedChangeset = scope.kind === 'changeset' ? changesetList.changesets.find((changeset) => changeset.id === scope.id) : undefined;
  useShowInFollowingWindow(showsChangeset && scopedChangeset ? changesetDiffPage(scopedChangeset) : null);
  // Conflicts are settled in the whole update, the merge updating makes; a changeset's files are what it did.
  const conflictOf = (path: string) => (conflictPaths.has(path) ? states.find((state) => state.file.key === path) : undefined);
  const fileMenu = (selected: DiffEntry[]) =>
    incomingFileMenu(selected, { workspacePath, scope, loadedChangeset: incoming.loadedChangeset, headChangeset: incoming.headChangeset, conflictOf, mergerFor, othersFor, running: Boolean(run.progress), decide, reset, resolveIn: (key, merger) => void resolveInTool(key, merger) });
  const selectedConflict = scope.kind === 'all' && focusedFile ? states.find((state) => state.file.key === focusedFile.path) : undefined;
  // A binary's versions are read only while it shows.
  const shownConflictKey = selectedConflict?.file.key;
  useEffect(() => openFile(shownConflictKey), [openFile, shownConflictKey]);

  const detail = () => {
    if (showsChangeset && scopedChangeset) {
      return <ChangesetDetails key={scopedChangeset.id} changeset={scopedChangeset} menu={changesetMenu(menuContext, [scopedChangeset])} withChangedFiles={false} />;
    }
    if (hidesAll) return null;
    if (selectedConflict) {
      return (
        <FileStepsContext.Provider value={conflictSteps}>
          <FileConflictPanel
            key={selectedConflict.file.key}
            workspacePath={workspacePath}
            state={selectedConflict}
            labels={UPDATE_LABELS}
            yoursInWorkspace
            toolActions={{ resolveIn: (key, merger) => void resolveInTool(key, merger), run: run.progress, runOffered: runPlans.length > 0 }}
            onDecide={(decision) => decide(selectedConflict.file.key, decision)}
            onStartOver={() => reset(selectedConflict.file.key)}
          />
        </FileStepsContext.Provider>
      );
    }
    if (focusedFile) return <IncomingFileDiff key={`${scope.kind}:${focusedFile.path}`} workspacePath={workspacePath} file={focusedFile} />;
    if (focusedGroup) {
      const name = focusedGroup.type === 'group' ? focusedGroup.label : focusedGroup.path;
      return <EmptyState icon={<Folder size={24} />} title={name} description={`${pluralize(focusedGroup.items.length, 'change')}. Select a file to see its diff.`} />;
    }
    return <EmptyState title="Select a changeset or a file" />;
  };

  return (
    <>
      {header(incomingSubtitle(incoming.branch, changesetList))}
      <UpdateBar
        incoming={incoming}
        pendingConflictCount={pendingConflictPaths.size}
        canUpdate={incoming.conflicts.length === 0 || Boolean(resolutions)}
        updating={updating}
        onUpdate={() => void update()}
        onShelveBlockedAndUpdate={() => void whileUpdating(() => shelveBlockedAndUpdate(workspacePath, incoming, resolutions))}
        run={run.progress || runPlans.length > 0 ? <ResolveRunControl states={states} run={run} plans={runPlans} /> : undefined}
      />
      <IncomingPanes
        list={
          <>
            <IncomingChangesetList
              changesets={changesetList.changesets}
              more={changesetList.more}
              older={changesetList.more ? { loading: changesetList.loading, onShowMore: changesetList.showMore } : undefined}
              scope={scope}
              onScope={changeScope}
              collapsed={changesetsCollapsed}
              onToggleCollapsed={toggleChangesets}
              changesetMenu={(changeset) => changesetMenu(menuContext, [changeset])}
            />
            <IncomingFiles
              changeset={scopedChangeset}
              onShowAll={() => changeScope(ALL_INCOMING)}
              files={files}
              summary={incomingFilesSummary(scope, files?.length ?? 0, files && scope.kind === 'all' ? files.filter(collides).length : 0)}
              rows={rows}
              tree={tree}
              toggleCollapsed={toggleFolder}
              query={filter.query}
              filterBar={filter.bar}
              noMatches={hidesAll && <NoMatches noun="files" onClear={filter.clear} />}
              selection={selection}
              onSelectionChange={selectFiles}
              contextMenu={fileMenu}
              markOf={(file) => <IncomingConflictMark file={file} conflictPaths={conflictPaths} conflictStates={conflictStates} blockedPaths={blockedPaths} />}
            />
          </>
        }
        detail={detail()}
      />
    </>
  );
}
