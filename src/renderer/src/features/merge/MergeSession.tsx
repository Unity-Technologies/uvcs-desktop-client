import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { DirectoryConflictResolution, MergePlan, MergeRequest } from '@shared/domain/merge';
import { Folder } from 'lucide-react';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useGroupedFileTree } from '../../components/useGroupedFileTree';
import { isHeaderRow } from '../../lib/groupedPathTree';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { defaultMergeComment } from '../mergeTask/mergeTaskSummary';
import type { TaskMerge } from '../mergeTask/taskMerge';
import { ResolveInWorkspaceMenu } from '../mergeTask/ResolveInWorkspaceMenu';
import { TaskMergeOptions } from '../mergeTask/TaskMergeOptions';
import { useFinishingTask } from '../mergeTask/useFinishingTask';
import { conflictedFilesOf } from './conflictedFiles';
import { MergeDetail } from './MergeDetail';
import type { MergeCompletion } from './MergeCompleted';
import { mergeLabels } from './mergeDescription';
import { MergeHeader } from './MergeHeader';
import { MergeItemList } from './MergeItemList';
import { buildMergeItems, firstWaiting, inListOrder, mergeItemAt, mergeItemGroups, mergeItemsActedOn, mergeItemTones, mergeProgress, type MergeItem, type MergeProgress } from './mergeItems';
import { mergeItemMenu } from './mergeItemMenu';
import { mergeItemTypes } from './mergeItemTypes';
import { ResolveRunControl, useRunOffer } from './mergeTools/ResolveRunControl';
import { useResolveRun } from './mergeTools/useResolveRun';
import { primaryMergeTool, useMergeTools } from './mergeTools/useMergeTools';
import { completeMerge } from './mergeOperations';
import { collectResolutions } from './mergeResolutions';
import { conflictStatusOf, planProgress, summarizePlan } from './mergeStatus';
import { useFileConflicts } from './resolve/useFileConflicts';
import { useSelectionFollowsItem } from './useSelectionFollowsItem';
import styles from './MergeSession.module.css';

interface MergeSessionProps {
  workspacePath: string;
  request: MergeRequest;
  plan: MergePlan;
  /** A task branch merged into a branch on the server, which the merge also finishes. */
  task?: TaskMerge;
  onCompleted: (completion: MergeCompletion) => void;
}

const itemKey = (item: MergeItem): string => item.key;
const itemPath = (item: MergeItem): string => item.path;

/** The decisions for one merge plan, from the first conflict to "Complete merge". */
export function MergeSession({ workspacePath, request, plan, task, onCompleted }: MergeSessionProps) {
  const labels = useMemo(() => mergeLabels(request, plan), [request, plan]);
  const conflictedFiles = useMemo(() => conflictedFilesOf(plan, request), [plan, request]);
  const { states: fileStates, decide, reset, resolveInTool } = useFileConflicts(workspacePath, conflictedFiles, labels);
  const [directoryResolutions, setDirectoryResolutions] = useState<(DirectoryConflictResolution | undefined)[]>([]);
  const [comment, setComment] = useState(() => (task ? defaultMergeComment(task.branch) : `Merge from ${labels.source}`));
  const { choices: taskChoices, setChoices: setTaskChoices, finishing } = useFinishingTask(task);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const selectedKey = selection.anchor;
  const [merging, setMerging] = useState(false);
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const latest = useRef<{ items: MergeItem[]; progress: MergeProgress } | null>(null);

  const intoServerBranch = Boolean(request.destinationBranch);
  const conflicting = plan.fileConflicts.length + plan.directoryConflicts.length > 0;
  // Thousands of items, from the plan alone: sorted and laid out once, not again for every version loaded or decision
  // made, which change only the progress the rows read.
  const items = useMemo(() => buildMergeItems(plan, conflictedFiles), [plan, conflictedFiles]);
  const progress = useMemo(() => mergeProgress(fileStates, directoryResolutions), [fileStates, directoryResolutions]);
  const typeOf = useMemo(() => mergeItemTypes(plan.changes.map((change) => change.path)), [plan.changes]);
  const mergeTools = useMergeTools();
  const preferredTool = primaryMergeTool(mergeTools);
  const filter = useChangeFilter(items, itemPath, mergeItemTones, { isViewFilter: true });
  const content = useMemo(() => ({ groups: mergeItemGroups(filter.visible) }), [filter.visible]);
  const { rows, tree, toggleCollapsed, rowKeyOf } = useGroupedFileTree(content, itemKey, folderListScope(workspacePath, `merge:${request.sourceSpec}:${request.destinationBranch ?? ''}`), selectedKey);
  const latestRowKeyOf = useRef(rowKeyOf);
  latestRowKeyOf.current = rowKeyOf;
  const conflictStatuses = useMemo(() => items.map((item) => conflictStatusOf(item, progress)).filter((status) => status !== null), [items, progress]);
  const resolutions = collectResolutions({ plan, fileStates, directoryResolutions, comment });
  const selected = mergeItemAt(items, rows, selectedKey);
  const selectedGroup = selected ? undefined : rows.filter(isHeaderRow).find((row) => row.key === selectedKey);
  // The list follows the keys at once; the file behind it (a few hundred ms to highlight a file of a few thousand
  // lines) follows once they stop coming, instead of every file an arrow key passes through holding the list back.
  const shown = useDeferredValue(selected);
  latest.current = { items, progress };

  // The selection follows the run while the user stays on the file it opened; looking elsewhere doesn't stop it.
  const followRun = useCallback((key: string, previousKey: string | undefined) => {
    setSelection((current) => (!previousKey || current.anchor === `file:${previousKey}` ? singleSelection(`file:${key}`) : current));
  }, []);
  // Once it ends: the first thing still waiting for the user, or else completing the merge.
  const afterRun = useCallback(() => {
    const waiting = latest.current && firstWaiting(latest.current.items, latest.current.progress);
    if (waiting) {
      setSelection(singleSelection(latestRowKeyOf.current(waiting.key)));
      listRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus({ preventScroll: true });
    } else {
      mergeButtonRef.current?.focus();
    }
  }, []);
  const run = useResolveRun({ states: fileStates, resolveInTool, onOpen: followRun, onEnd: afterRun });
  const runPlans = useRunOffer(fileStates, run);

  // Start on the first thing that needs the user, as the list shows them, else on its first row.
  useEffect(() => {
    if (!selectedKey && items.length > 0) setSelection(singleSelection(rowKeyOf((firstWaiting(items, progress) ?? inListOrder(items)[0]!).key)));
  }, [selectedKey, items, progress, rowKeyOf]);

  // A folder conflict is its folder's row in a tree and a row of its own in a list: switching keeps it selected.
  const listedKeys = useMemo(() => new Set(filter.visible.map(itemKey)), [filter.visible]);
  useSelectionFollowsItem(selectedKey, selected?.key, selection, setSelection, (key) => listedKeys.has(key), rowKeyOf);

  const resolveDirectoryConflict = (index: number, resolution: DirectoryConflictResolution): void =>
    setDirectoryResolutions((current) => Object.assign([...current], { [index]: resolution }));

  const merge = async (): Promise<void> => {
    if (!resolutions) return;
    setMerging(true);
    const result = await completeMerge(workspacePath, request, resolutions, finishing);
    setMerging(false);
    if (result) onCompleted({ labels, changeCount: plan.changes.length, conflictCount: conflictStatuses.length });
  };

  return (
    <div className={styles.session}>
      <MergeHeader
        request={request}
        plan={plan}
        labels={labels}
        progress={planProgress(conflictStatuses)}
        summary={summarizePlan(plan.changes.length, conflictStatuses)}
        intoServerBranch={intoServerBranch}
        comment={comment}
        onCommentChange={setComment}
        canMerge={Boolean(resolutions) && !merging}
        merging={merging}
        onMerge={() => void merge()}
        run={run.progress || runPlans.length > 0 ? { control: <ResolveRunControl states={fileStates} run={run} plans={runPlans} />, running: Boolean(run.progress) } : undefined}
        options={finishing && <TaskMergeOptions review={finishing.review} choices={taskChoices} onChange={setTaskChoices} />}
        alternative={
          task &&
          conflicting &&
          request.destinationBranch && <ResolveInWorkspaceMenu workspacePath={workspacePath} sourceSpec={request.sourceSpec} destination={request.destinationBranch} task={task} />
        }
        mergeButtonRef={mergeButtonRef}
      />
      <SplitPane
        initialSize={360}
        minSize={240}
        maxSize={640}
        first={
          <div ref={listRef} className={styles.list}>
            <MergeItemList
              rows={rows}
              progress={progress}
              tree={tree}
              toggleCollapsed={toggleCollapsed}
              typeOf={typeOf}
              labels={labels}
              query={filter.query}
              filterBar={filter.bar}
              selection={selection}
              onSelectionChange={setSelection}
              contextMenu={(selectedItems) =>
                mergeItemMenu(mergeItemsActedOn(rows, selection.selected, selectedItems), {
                  workspacePath,
                  request,
                  plan,
                  progress,
                  labels,
                  itemTypeOf: typeOf,
                  preferredTool,
                  running: Boolean(run.progress),
                  decide,
                  reset,
                  resolveIn: (key, tool) => void resolveInTool(key, tool),
                  resolveDirectory: resolveDirectoryConflict,
                })
              }
            />
          </div>
        }
        second={
          shown ? (
            <MergeDetail
              workspacePath={workspacePath}
              item={shown}
              progress={progress}
              plan={plan}
              labels={labels}
              request={request}
              toolActions={{ resolveIn: (key, tool) => void resolveInTool(key, tool), run: run.progress, runOffered: runPlans.length > 0 }}
              onDecideFile={decide}
              onStartOverFile={reset}
              onResolveDirectory={resolveDirectoryConflict}
            />
          ) : selectedGroup ? (
            <EmptyState
              icon={<Folder size={24} />}
              title={selectedGroup.type === 'group' ? selectedGroup.label : selectedGroup.path}
              description={`${pluralize(selectedGroup.items.length, 'item')}. Select one to see what the merge does to it.`}
            />
          ) : (
            <EmptyState title="Nothing selected" />
          )
        }
      />
    </div>
  );
}

