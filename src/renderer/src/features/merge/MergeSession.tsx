import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { DirectoryConflictResolution, MergePlan, MergeRequest } from '@shared/domain/merge';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { conflictedFilesOf } from './conflictedFiles';
import { MergeDetail } from './MergeDetail';
import type { MergeCompletion } from './MergeCompleted';
import { mergeLabels } from './mergeDescription';
import { MergeHeader } from './MergeHeader';
import { MergeItemList } from './MergeItemList';
import { buildMergeItems, needsDecision, toListRows, type MergeItem } from './mergeItems';
import { ResolveRunControl, useRunOffer } from './mergeTools/ResolveRunControl';
import { useResolveRun } from './mergeTools/useResolveRun';
import { completeMerge } from './mergeOperations';
import { collectResolutions, needsServerFilePolicy, type ServerFilePolicy } from './mergeResolutions';
import { conflictStatusOf, planProgress, summarizePlan } from './mergeStatus';
import { useFileConflicts, type FileConflictState } from './resolve/useFileConflicts';
import styles from './MergeSession.module.css';

interface MergeSessionProps {
  workspacePath: string;
  request: MergeRequest;
  plan: MergePlan;
  onCompleted: (completion: MergeCompletion) => void;
}

/** The decisions for one merge plan, from the first conflict to "Complete merge". */
export function MergeSession({ workspacePath, request, plan, onCompleted }: MergeSessionProps) {
  const labels = useMemo(() => mergeLabels(request, plan), [request, plan]);
  const conflictedFiles = useMemo(() => conflictedFilesOf(plan, request), [plan, request]);
  const { states: fileStates, decide, reset, resolveInTool } = useFileConflicts(workspacePath, conflictedFiles, labels);
  const [directoryResolutions, setDirectoryResolutions] = useState<(DirectoryConflictResolution | undefined)[]>([]);
  const [serverFilePolicy, setServerFilePolicy] = useState<ServerFilePolicy>();
  const [comment, setComment] = useState(`Merge from ${labels.source}`);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const latestItems = useRef<MergeItem[]>([]);

  const intoServerBranch = Boolean(request.destinationBranch);
  const serverPolicyNeeded = intoServerBranch && needsServerFilePolicy(fileStates);
  // Thousands of items: built again only when a decision changes, not for every file selected or key typed.
  const items = useMemo(
    () => buildMergeItems(plan, serverPolicyNeeded ? withServerPolicy(fileStates, serverFilePolicy) : fileStates, directoryResolutions),
    [plan, serverPolicyNeeded, fileStates, serverFilePolicy, directoryResolutions],
  );
  const rows = useMemo(() => toListRows(items), [items]);
  const conflictStatuses = useMemo(() => items.map(conflictStatusOf).filter((status) => status !== null), [items]);
  const resolutions = collectResolutions({
    plan,
    fileStates,
    directoryResolutions,
    serverFilePolicy: serverPolicyNeeded ? serverFilePolicy : undefined,
    intoServerBranch,
    comment,
  });
  const selected = items.find((item) => item.key === selectedKey);
  // The list follows the keys at once; the file behind it (a few hundred ms to highlight a file of a few thousand
  // lines) follows once they stop coming, instead of every file an arrow key passes through holding the list back.
  const shown = useDeferredValue(selected);
  latestItems.current = items;

  // The selection follows the run while the user stays on the file it opened; looking elsewhere doesn't stop it.
  const followRun = useCallback((key: string, previousKey: string | undefined) => {
    setSelectedKey((current) => (!previousKey || current === `file:${previousKey}` ? `file:${key}` : current));
  }, []);
  // Once it ends: the first thing still waiting for the user, or else completing the merge.
  const afterRun = useCallback(() => {
    const waiting = latestItems.current.find(needsDecision);
    if (waiting) {
      setSelectedKey(waiting.key);
      listRef.current?.focus({ preventScroll: true });
    } else {
      mergeButtonRef.current?.focus();
    }
  }, []);
  const run = useResolveRun({ states: fileStates, resolveInTool, onOpen: followRun, onEnd: afterRun });
  const runPlans = useRunOffer(intoServerBranch ? [] : fileStates, run);

  // Start on the first thing that needs the user.
  useEffect(() => {
    if (!selectedKey && items.length > 0) setSelectedKey((items.find(needsDecision) ?? items[0]!).key);
  }, [selectedKey, items]);

  const resolveDirectoryConflict = (index: number, resolution: DirectoryConflictResolution): void =>
    setDirectoryResolutions((current) => Object.assign([...current], { [index]: resolution }));

  const merge = async (): Promise<void> => {
    if (!resolutions) return;
    setMerging(true);
    const result = await completeMerge(workspacePath, request, resolutions);
    setMerging(false);
    if (result) onCompleted({ result, labels, changeCount: plan.changes.length, conflictCount: conflictStatuses.length });
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
        mergeButtonRef={mergeButtonRef}
      />
      <SplitPane
        initialSize={360}
        minSize={240}
        maxSize={640}
        first={<MergeItemList
            ref={listRef}
            rows={rows}
            labels={labels}
            selectedKey={selectedKey}
            runKey={run.progress && `file:${run.progress.currentKey}`}
            onSelect={setSelectedKey}
          />}
        second={
          shown ? (
            <MergeDetail
              workspacePath={workspacePath}
              item={shown}
              plan={plan}
              labels={labels}
              request={request}
              serverPolicy={{
                needed: serverPolicyNeeded,
                fileCount: fileStates.length,
                policy: serverFilePolicy,
                onChoose: setServerFilePolicy,
              }}
              toolActions={{ resolveIn: (key, tool) => void resolveInTool(key, tool), run: run.progress, runOffered: runPlans.length > 0 }}
              onDecideFile={decide}
              onStartOverFile={reset}
              onResolveDirectory={resolveDirectoryConflict}
            />
          ) : (
            <EmptyState title="Nothing selected" />
          )
        }
      />
    </div>
  );
}

/** A server merge's files all wait for the side to keep; once it is chosen, none of them waits anymore. */
function withServerPolicy(fileStates: FileConflictState[], policy: ServerFilePolicy | undefined): FileConflictState[] {
  return fileStates.map((state) => ({ ...state, resolution: policy ? { choice: policy } : null, mergedAutomatically: false }));
}
