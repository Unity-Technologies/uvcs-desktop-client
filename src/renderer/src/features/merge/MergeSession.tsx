import { useEffect, useMemo, useState } from 'react';
import type { DirectoryConflictResolution, MergePlan, MergeRequest } from '@shared/domain/merge';
import { EmptyState } from '../../ui/EmptyState';
import { SplitPane } from '../../ui/SplitPane';
import { conflictedFilesOf } from './conflictedFiles';
import { MergeDetail } from './MergeDetail';
import { mergeLabels } from './mergeDescription';
import { MergeHeader } from './MergeHeader';
import { MergeItemList } from './MergeItemList';
import { buildMergeItems, needsDecision, toListRows } from './mergeItems';
import { completeMerge } from './mergeOperations';
import { collectResolutions, needsServerFilePolicy, type ServerFilePolicy } from './mergeResolutions';
import { useFileConflicts, type FileConflictState } from './resolve/useFileConflicts';
import styles from './MergeSession.module.css';

interface MergeSessionProps {
  workspacePath: string;
  request: MergeRequest;
  plan: MergePlan;
}

/** The decisions for one merge plan, from the first conflict to "Complete merge". */
export function MergeSession({ workspacePath, request, plan }: MergeSessionProps) {
  const labels = useMemo(() => mergeLabels(request, plan), [request, plan]);
  const conflictedFiles = useMemo(() => conflictedFilesOf(plan, request), [plan, request]);
  const { states: fileStates, decide, reset } = useFileConflicts(workspacePath, conflictedFiles, labels);
  const [directoryResolutions, setDirectoryResolutions] = useState<(DirectoryConflictResolution | undefined)[]>([]);
  const [serverFilePolicy, setServerFilePolicy] = useState<ServerFilePolicy>();
  const [comment, setComment] = useState(`Merge from ${labels.source}`);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const intoServerBranch = Boolean(request.destinationBranch);
  const serverPolicyNeeded = intoServerBranch && needsServerFilePolicy(fileStates);
  const decidedFileStates = serverPolicyNeeded && serverFilePolicy ? withServerPolicy(fileStates, serverFilePolicy) : fileStates;
  const items = buildMergeItems(plan, decidedFileStates, directoryResolutions);
  const rows = toListRows(items);
  const pendingCount = items.filter(needsDecision).length;
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

  const merge = async (): Promise<void> => {
    if (!resolutions) return;
    setMerging(true);
    await completeMerge(workspacePath, request, resolutions);
    setMerging(false);
  };

  return (
    <div className={styles.session}>
      <MergeHeader
        request={request}
        plan={plan}
        labels={labels}
        pendingCount={pendingCount}
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
        first={<MergeItemList rows={rows} selectedKey={selectedKey} onSelect={setSelectedKey} />}
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
              onDecideFile={decide}
              onStartOverFile={reset}
              directoryResolution={selected.kind === 'directoryConflict' ? directoryResolutions[selected.index] : undefined}
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

/** Once a server merge keeps one side for every conflicting file, none of them waits for the user anymore. */
function withServerPolicy(fileStates: FileConflictState[], policy: ServerFilePolicy): FileConflictState[] {
  return fileStates.map((state) => ({ ...state, resolution: { choice: policy }, mergedAutomatically: false }));
}
