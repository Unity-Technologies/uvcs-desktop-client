import { useEffect, useMemo, useState } from 'react';
import type { DirectoryConflictResolution, MergePlan, MergeRequest } from '@shared/domain/merge';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { conflictedFilesOf } from './conflictedFiles';
import { MergeDetail } from './MergeDetail';
import type { MergeCompletion } from './MergeCompleted';
import { mergeLabels } from './mergeDescription';
import { MergeHeader } from './MergeHeader';
import { MergeItemList } from './MergeItemList';
import { buildMergeItems, needsDecision, toListRows } from './mergeItems';
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
  const { states: fileStates, decide, reset, resolveInTool, resolveAllInTool } = useFileConflicts(workspacePath, conflictedFiles, labels);
  const [directoryResolutions, setDirectoryResolutions] = useState<(DirectoryConflictResolution | undefined)[]>([]);
  const [serverFilePolicy, setServerFilePolicy] = useState<ServerFilePolicy>();
  const [comment, setComment] = useState(`Merge from ${labels.source}`);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const intoServerBranch = Boolean(request.destinationBranch);
  const serverPolicyNeeded = intoServerBranch && needsServerFilePolicy(fileStates);
  const decidedFileStates = serverPolicyNeeded ? withServerPolicy(fileStates, serverFilePolicy) : fileStates;
  const items = buildMergeItems(plan, decidedFileStates, directoryResolutions);
  const rows = toListRows(items);
  const resolutions = collectResolutions({
    plan,
    fileStates,
    directoryResolutions,
    serverFilePolicy: serverPolicyNeeded ? serverFilePolicy : undefined,
    intoServerBranch,
    comment,
  });
  const selected = items.find((item) => item.key === selectedKey);

  // Start on the first thing that needs the user.
  useEffect(() => {
    if (!selectedKey && items.length > 0) setSelectedKey((items.find(needsDecision) ?? items[0]!).key);
  }, [selectedKey, items]);

  const resolveDirectoryConflict = (index: number, resolution: DirectoryConflictResolution): void =>
    setDirectoryResolutions((current) => Object.assign([...current], { [index]: resolution }));

  const conflictStatuses = items.map(conflictStatusOf).filter((status) => status !== null);

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
      />
      <SplitPane
        initialSize={360}
        minSize={240}
        maxSize={640}
        first={<MergeItemList rows={rows} labels={labels} selectedKey={selectedKey} onSelect={setSelectedKey} />}
        second={
          selected ? (
            <MergeDetail
              workspacePath={workspacePath}
              item={selected}
              plan={plan}
              labels={labels}
              request={request}
              serverPolicy={{
                needed: serverPolicyNeeded,
                fileCount: fileStates.length,
                policy: serverFilePolicy,
                onChoose: setServerFilePolicy,
              }}
              toolActions={{ resolveIn: (key, tool) => void resolveInTool(key, tool), resolveAllIn: (tool) => void resolveAllInTool(tool), states: fileStates }}
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
