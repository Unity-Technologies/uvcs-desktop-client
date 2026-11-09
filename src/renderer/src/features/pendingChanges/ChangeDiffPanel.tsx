import { useMemo, useState, type ReactNode } from 'react';
import { workspacePlace } from '@shared/domain/place';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ReviewMark } from '@shared/domain/review';
import { api } from '../../api/client';
import { runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByPendingChangeEdit } from '../../app/refresh/refreshScopes';
import { fileNameOf } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { toast } from '../../ui/toast/toastStore';
import { DiffFileTitle } from '../diff/viewer/DiffFileTitle';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import { LineLinksContext, type LineLinks } from '../diff/viewer/lineLinks';
import { ONLY_MOVED } from '../diff/viewer/movedFrom';
import { SinceReviewButton } from '../review/SinceReviewButton';
import { describeKinds } from './changeCategories';
import { changeDiffSources } from './changeDiffSources';
import { useRequestedLineFocus } from './changesLineFocus';
import { diffedItem } from '../../lib/unityMetaPairs';
import { useMetaShownFor } from './changesMetaDiff';
import { MetaDiffButton } from '../../components/MetaDiffButton';
import { changeStatus } from './changeTone';

interface ChangeDiffPanelProps {
  workspacePath: string;
  change: PendingChange;
  /** The Unity `.meta` listed with the asset (`pairPendingMetas`): the diff can show it instead. */
  meta?: PendingChange;
  /** When the file changed since it was reviewed, the diff can show only that. */
  reviewMark?: ReviewMark;
  /** Instead of the file's path and status, where the page shows them already (Files). */
  title?: ReactNode;
}

export function ChangeDiffPanel({ workspacePath, change: asset, meta, reviewMark, title: ownTitle }: ChangeDiffPanelProps) {
  // Per asset, like "Since review": its menu's "Open .meta diff" or the toggle shows the meta, until another asset shows.
  const [metaShownFor, setMetaShownFor] = useMetaShownFor(workspacePath, asset.path);
  const change = diffedItem(asset, meta, metaShownFor);
  const showsMeta = change !== asset;
  // Per file: "Since review" is a way to look at one file, not a mode that follows the selection.
  const [sinceReviewPath, setSinceReviewPath] = useState<string | null>(null);
  const canCompareWithReview = !showsMeta && reviewMark?.state === 'changedSinceReview' && reviewMark.hasSnapshot;
  const sinceReview = canCompareWithReview && sinceReviewPath === change.path;
  // A link's lines (`…/-/changes/a.cs#L42`, `requestLineFocus`): the diff opens scrolled to them, marked. Changes
  // offers no link of its own: its lines aren't published.
  const requestedLines = useRequestedLineFocus(workspacePath, change.path);
  const lineLinks = useMemo<LineLinks>(() => ({ focus: requestedLines ? { path: change.path, lines: requestedLines } : null, publishes: false }), [requestedLines, change.path]);

  const metaToggle = meta && <MetaDiffButton pressed={showsMeta} onChange={(pressed) => setMetaShownFor(pressed ? asset.path : null)} />;
  const title = ownTitle ?? <DiffFileTitle status={changeStatus(change)} path={change.path} oldPath={change.oldPath} />;

  if (change.itemType === 'directory') {
    return <EmptyState title={change.path} description={`Directory · ${describeKinds(change)}`} action={metaToggle} />;
  }

  const sources = changeDiffSources(change);
  const original = sinceReview ? { kind: 'reviewSnapshot' as const, path: change.path } : sources.original;
  const compareControls = (canCompareWithReview || metaToggle) && (
    <>
      {canCompareWithReview && <SinceReviewButton pressed={sinceReview} onChange={(pressed) => setSinceReviewPath(pressed ? change.path : null)} />}
      {metaToggle}
    </>
  );

  return (
    <LineLinksContext.Provider value={lineLinks}>
      <FileDiffViewer
        place={workspacePlace(workspacePath)}
        original={original}
        modified={sources.modified}
        fileName={change.path}
        title={title}
        identicalDescription={sinceReview ? 'The file is back to how it was when you reviewed it.' : change.oldPath ? ONLY_MOVED : undefined}
        compareControls={compareControls}
        onMatchesBase={change.kinds.includes('checkedOut') ? () => offerUndoCheckout(workspacePath, change.path) : undefined}
      />
    </LineLinksContext.Provider>
  );
}

/** Reverting its last block left a checked-out file as it was loaded: offer to drop the checkout too. */
function offerUndoCheckout(workspacePath: string, path: string): void {
  toast.success(`${fileNameOf(path)} is back to its loaded revision`, undefined, {
    label: 'Undo checkout',
    run: () => void runVoidAction(workspacePlace(workspacePath), "Couldn't undo the checkout", () => api.pendingChanges.undoUnchanged(workspacePath, [path]), isAffectedByPendingChangeEdit),
  });
}
