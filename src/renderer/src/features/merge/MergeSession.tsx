import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import { Folder } from 'lucide-react';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { MetaDiffButton } from '../../components/MetaDiffButton';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useGroupedFileTree } from '../../components/useGroupedFileTree';
import { isHeaderRow } from '../../lib/groupedPathTree';
import { rangeLength } from '../../lib/itemRange';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { pluralize } from '../../lib/text';
import { hidesEveryRow } from '../../lib/hidesEveryRow';
import { assetOfMeta, diffedItem } from '../../lib/unityMetaPairs';
import { EmptyState } from '../../ui/EmptyState';
import { NoMatches } from '../../ui/NoMatches';
import { useDiffMetaShownFor } from '../diff/useDiffMetaShownFor';
import { FileStepsContext, selectNow, useFileSteps } from '../diff/viewer/fileSteps';
import { defaultMergeComment } from '../mergeTask/mergeTaskSummary';
import type { TaskMerge } from '../mergeTask/taskMerge';
import { ResolveInWorkspaceMenu } from '../mergeTask/ResolveInWorkspaceMenu';
import { TaskMergeOptions } from '../mergeTask/TaskMergeOptions';
import { useFinishingTask } from '../mergeTask/useFinishingTask';
import { conflictedFilesOf } from './conflictedFiles';
import { conflictStepKeys } from './conflictSteps';
import { useDirectoryDecisions } from './directoryConflicts/useDirectoryDecisions';
import { MergeDetail } from './MergeDetail';
import type { MergeCompletion } from './MergeCompleted';
import { mergeLabels } from './mergeDescription';
import { MergeHeader } from './MergeHeader';
import { MergeItemList } from './MergeItemList';
import { MergeOptionsMenu } from './MergeOptionsMenu';
import { contributorDecisions, contributorOf, mergeOptionsOffered, type Contributor } from './mergeOptions';
import { MergePanes } from './MergePanes';
import { buildMergeItems, firstWaiting, inListOrder, mergeItemAt, mergeItemGroups, mergeItemsActedOn, mergeItemTones, MERGE_ITEM_FACTS, MERGE_VIEW_OFFER, mergeProgress, needsDecision, type MergeItem } from './mergeItems';
import { mergeItemMenu } from './mergeItemMenu';
import { pairMergeMetas } from './mergeMetaPairs';
import { mergeItemTypes } from './mergeItemTypes';
import { ResolveRunControl, useRunOffer } from './mergeTools/ResolveRunControl';
import { useResolveRun } from './mergeTools/useResolveRun';
import { useFileMergers } from './mergeTools/useMergeTools';
import { completeMerge } from './mergeOperations';
import { collectResolutions } from './mergeResolutions';
import { conflictStatusOf, planProgress, summarizePlan } from './mergeStatus';
import { useFileConflicts } from './resolve/useFileConflicts';
import { useSelectionFollowsItem } from './useSelectionFollowsItem';

interface MergeSessionProps {
  workspacePath: string;
  request: MergeRequest;
  /** The merge before any directory decision: each one applied makes `cm` calculate it again (`useDirectoryDecisions`). */
  initialPlan: MergePlan;
  /** A task branch merged into a branch on the server, which the merge also finishes. */
  task?: TaskMerge;
  onCompleted: (completion: MergeCompletion) => void;
  /** A request with other merge options: the page previews it again (`MergeOptionsMenu`). */
  onRequestChange: (request: MergeRequest) => void;
}

const itemKey = (item: MergeItem): string => item.key;
const itemPath = (item: MergeItem): string => item.path;

/** The decisions for one merge plan, from the first conflict to "Complete merge". */
export function MergeSession({ workspacePath, request, initialPlan, task, onCompleted, onRequestChange }: MergeSessionProps) {
  const directory = useDirectoryDecisions(workspacePath, request, initialPlan);
  const { plan } = directory;
  // The contributors stay with every decision: the labels, and every file state built on them, stay as they are.
  const labels = useMemo(() => mergeLabels(request, initialPlan), [request, initialPlan]);
  const conflictedFiles = useMemo(() => conflictedFilesOf(plan, request), [plan, request]);
  const { states: fileStates, decide, reset, resolveInTool, openFile } = useFileConflicts(workspacePath, conflictedFiles, labels);
  const optionsOffered = mergeOptionsOffered(request, fileStates.length);
  const chooseContributor = (contributor: Contributor): void => {
    for (const { key, decision } of contributorDecisions(fileStates, contributor)) {
      if (decision) decide(key, decision);
      else reset(key);
    }
  };
  const [comment, setComment] = useState(() => (task ? defaultMergeComment(task.branch) : `Merge from ${labels.source}`));
  const { choices: taskChoices, setChoices: setTaskChoices, finishing } = useFinishingTask(task);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const selectedKey = selection.anchor;
  const [merging, setMerging] = useState(false);
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const intoServerBranch = Boolean(request.destinationBranch);
  const conflicting = plan.fileConflicts.length + plan.directoryConflicts.length > 0;
  // Thousands of items, from the plan and the directory decisions alone: sorted and laid out once, not again for every
  // version loaded or file decided, which change only the progress the rows read.
  const items = useMemo(() => buildMergeItems(plan, directory.decisions, conflictedFiles), [plan, directory.decisions, conflictedFiles]);
  // The list shows each Unity `.meta` change with its asset's; the progress and the merge itself count every item.
  const pairs = useMemo(() => pairMergeMetas(items), [items]);
  const progress = useMemo(() => mergeProgress(fileStates, directory.resolutions, directory.applying), [fileStates, directory.resolutions, directory.applying]);
  const latest = useRef({ items: pairs.shown, progress });
  const typeOf = useMemo(() => mergeItemTypes(plan.changes.map((change) => change.path)), [plan.changes]);
  const { mergerFor, othersFor } = useFileMergers();
  const filter = useChangeFilter(pairs.shown, itemPath, mergeItemTones, { isViewFilter: true, viewOffer: MERGE_VIEW_OFFER });
  const content = useMemo(() => ({ groups: mergeItemGroups(filter.visible) }), [filter.visible]);
  // Nothing to select while the filters hide every item: the detail pane stays blank.
  const hidesAll = hidesEveryRow(pairs.shown.length, filter.visible.length);
  const { rows, tree, toggleCollapsed, rowKeyOf, folding } = useGroupedFileTree(content, pairs.shown, itemKey, folderListScope(workspacePath, `merge:${request.sourceSpec}:${request.destinationBranch ?? ''}`), MERGE_ITEM_FACTS, selectedKey);
  const latestRowKeyOf = useRef(rowKeyOf);
  latestRowKeyOf.current = rowKeyOf;
  const conflictStatuses = useMemo(() => items.map((item) => conflictStatusOf(item, progress)).filter((status) => status !== null), [items, progress]);
  const resolutions = collectResolutions({ plan, fileStates, directoryDecisionsId: directory.decisionsId, comment });
  const selected = mergeItemAt(pairs.shown, rows, selectedKey);
  const selectedGroup = selected ? undefined : rows.filter(isHeaderRow).find((row) => row.key === selectedKey);
  // The list follows the keys at once; the file behind it (a few hundred ms to highlight a file of a few thousand
  // lines) follows once they stop coming, instead of every file an arrow key passes through holding the list back.
  const shown = useDeferredValue(selected);
  latest.current = { items: pairs.shown, progress };
  // A binary's versions are read only while it shows.
  const shownFileKey = shown?.kind === 'fileConflict' ? shown.file.key : undefined;
  useEffect(() => openFile(shownFileKey), [openFile, shownFileKey]);
  // A change listed with its `.meta` shows the asset's diff, or the meta's from its toggle or menu.
  const [metaShownFor, setMetaShownFor] = useDiffMetaShownFor(shown?.path);
  const shownMeta = shown && pairs.metaOf(shown);
  const diffed = shown && diffedItem(shown, shownMeta, metaShownFor);
  const metaToggle = shown && shownMeta && <MetaDiffButton pressed={diffed !== shown} onChange={(pressed) => setMetaShownFor(pressed ? shown.path : null)} />;
  const showMetaOf = (meta: MergeItem) => {
    const asset = pairs.shown.find((item) => item.path === assetOfMeta(meta.path));
    if (!asset) return;
    setSelection(singleSelection(rowKeyOf(asset.key)));
    setMetaShownFor(asset.path);
  };

  // The selection follows the run while the user stays on the file it opened; looking elsewhere doesn't stop it.
  const followRun = useCallback((key: string, previousKey: string | undefined) => {
    setSelection((current) => (!previousKey || current.anchor === `file:${previousKey}` ? singleSelection(`file:${key}`) : current));
  }, []);
  // Once it ends: the first thing still waiting for the user, or else completing the merge.
  const afterRun = useCallback(() => {
    const waiting = firstWaiting(latest.current.items, latest.current.progress);
    if (waiting) {
      setSelection(singleSelection(latestRowKeyOf.current(waiting.key)));
      listRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus({ preventScroll: true });
    } else {
      mergeButtonRef.current?.focus();
    }
  }, []);
  const run = useResolveRun({ states: fileStates, mergerFor, resolveInTool, onOpen: followRun, onEnd: afterRun });
  const runPlans = useRunOffer(fileStates, run);

  // Start on the first thing that needs the user, as the list shows them (a `.meta` joined to its asset is never one), else on its first row.
  useEffect(() => {
    if (!selectedKey && items.length > 0) setSelection(singleSelection(rowKeyOf((firstWaiting(pairs.shown, progress) ?? inListOrder(pairs.shown)[0]!).key)));
  }, [selectedKey, items, pairs.shown, progress, rowKeyOf]);

  // A conflicting file's arrows go on past its first or last conflict to the files around it that wait for the user.
  const conflictKeys = useMemo(() => conflictStepKeys(rows, selectedKey, (item) => item.kind === 'fileConflict' && needsDecision(item, progress)), [rows, selectedKey, progress]);
  const conflictSteps = useFileSteps({
    keys: conflictKeys,
    current: selectedKey,
    select: (key, selected) => selectNow(selected, () => setSelection(singleSelection(key))),
    pathOf: (key) => {
      const item = mergeItemAt(pairs.shown, rows, key);
      return item?.kind === 'fileConflict' ? item.file.path : key;
    },
  });

  // A folder conflict is its folder's row in a tree and a row of its own in a list: switching keeps it selected.
  const listedKeys = useMemo(() => new Set(filter.visible.map(itemKey)), [filter.visible]);
  useSelectionFollowsItem(selectedKey, selected?.key, selection, setSelection, (key) => listedKeys.has(key), rowKeyOf);

  const merge = async (): Promise<void> => {
    if (!resolutions) return;
    setMerging(true);
    const result = await completeMerge(workspacePath, request, resolutions, finishing);
    setMerging(false);
    if (result) onCompleted({ labels, changeCount: plan.changes.length, conflictCount: conflictStatuses.length });
  };

  return (
    <MergePanes
      header={
        <MergeHeader
          request={request}
          plan={plan}
          labels={labels}
          progress={planProgress(conflictStatuses)}
          summary={summarizePlan(plan.changes.length, conflictStatuses)}
          intoServerBranch={intoServerBranch}
          comment={comment}
          onCommentChange={setComment}
          canMerge={Boolean(resolutions) && !merging && directory.applying === null}
          merging={merging}
          onMerge={() => void merge()}
          run={run.progress || runPlans.length > 0 ? { control: <ResolveRunControl states={fileStates} run={run} plans={runPlans} />, running: Boolean(run.progress) } : undefined}
          mergeOptions={
            optionsOffered.any && (
              <MergeOptionsMenu
                request={request}
                labels={labels}
                offered={optionsOffered}
                contributor={contributorOf(fileStates)}
                onContributorChange={chooseContributor}
                onRequestChange={onRequestChange}
              />
            )
          }
          options={finishing && <TaskMergeOptions review={finishing.review} user={finishing.user} choices={taskChoices} onChange={setTaskChoices} />}
          alternative={
            task &&
            conflicting &&
            request.destinationBranch && <ResolveInWorkspaceMenu workspacePath={workspacePath} sourceSpec={request.sourceSpec} destination={request.destinationBranch} task={task} />
          }
          mergeButtonRef={mergeButtonRef}
        />
      }
      listRef={listRef}
      list={
        <MergeItemList
          rows={rows}
          progress={progress}
          tree={tree}
          toggleCollapsed={toggleCollapsed}
          folding={folding}
          typeOf={typeOf}
          labels={labels}
          query={filter.query}
          filterBar={filter.bar}
          noMatches={hidesAll && <NoMatches noun="files" onClear={filter.clear} />}
          selection={selection}
          metaOf={pairs.metaOf}
          onSelectionChange={setSelection}
          contextMenu={(selectedItems) =>
            mergeItemMenu(mergeItemsActedOn(rows, selection.selected, selectedItems), {
              workspacePath,
              request,
              plan,
              progress,
              labels,
              itemTypeOf: typeOf,
              mergerFor,
              othersFor,
              running: Boolean(run.progress),
              decide,
              reset,
              resolveIn: (key, merger) => void resolveInTool(key, merger),
              resolveDirectory: (conflict, resolution) => void directory.decide(conflict, resolution),
              metaOf: pairs.metaOf,
              onMetaDiff: showMetaOf,
            })
          }
        />
      }
      detail={
        hidesAll ? null : shown && diffed ? (
          <FileStepsContext.Provider value={shown.kind === 'fileConflict' ? conflictSteps : null}>
            <MergeDetail
              workspacePath={workspacePath}
              key={diffed.path}
              item={diffed}
              compareControls={metaToggle}
              progress={progress}
              plan={plan}
              labels={labels}
              request={request}
              toolActions={{ resolveIn: (key, merger) => void resolveInTool(key, merger), run: run.progress, runOffered: runPlans.length > 0 }}
              onDecideFile={decide}
              onStartOverFile={reset}
              onResolveDirectory={(conflict, resolution) => void directory.decide(conflict, resolution)}
            />
          </FileStepsContext.Provider>
        ) : selectedGroup ? (
          <EmptyState
            icon={<Folder size={24} />}
            title={selectedGroup.type === 'group' ? selectedGroup.label : selectedGroup.path}
            description={`${pluralize(rangeLength(selectedGroup.held), 'item')}. Select one to see what the merge does to it.`}
          />
        ) : (
          <EmptyState title="Nothing selected" />
        )
      }
    />
  );
}
