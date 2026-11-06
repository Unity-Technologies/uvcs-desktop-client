import type { MergeRequest } from '@shared/domain/merge';
import { offersCommonAncestor, offersIgnoreMergeTracking } from '@shared/domain/mergeOptions';
import { spec } from '@shared/domain/specs';
import type { FileConflictDecision } from './resolve/fileConflictDecision';
import type { FileConflictState } from './resolve/useFileConflicts';
import type { MergeLabels } from './mergeDescription';

/**
 * Who contributes to every conflicting file: both sides, merged automatically where they can be ("Merge both"), or
 * one side kept whole. It decides the files the way each file's own "Keep" does, so it is applied, not passed to `cm`.
 */
export type Contributor = 'both' | 'destination' | 'source';

/** What the contributor choice reads of a conflicting file. */
export type ContributorFile = Pick<FileConflictState, 'decidedByUser' | 'decision' | 'openTool'> & { file: Pick<FileConflictState['file'], 'key'> };

/** A decision to apply to one file; null starts it over, back to the automatic merge. */
export interface ContributorDecision {
  key: string;
  decision: FileConflictDecision | null;
}

/** Which merge options a merge offers: the contributor where files conflict, the rest where `cm` accepts them. */
export interface MergeOptionsOffered {
  contributor: boolean;
  ignoreMergeTracking: boolean;
  commonAncestor: boolean;
  /** Whether there is anything to show at all. */
  any: boolean;
}

export function mergeOptionsOffered(request: MergeRequest, fileConflictCount: number): MergeOptionsOffered {
  const contributor = fileConflictCount > 0;
  const ignoreMergeTracking = offersIgnoreMergeTracking(request);
  const commonAncestor = offersCommonAncestor(request);
  return { contributor, ignoreMergeTracking, commonAncestor, any: contributor || ignoreMergeTracking || commonAncestor };
}

/** Whether the request changes how the merge is calculated: the plan read with it may fail where one without wouldn't. */
export function hasMergeOptions(request: MergeRequest): boolean {
  return Boolean(request.ignoreMergeTracking) || request.ancestorSpec !== undefined;
}

/** Whether a merge with nothing to merge can apply the changes again, ignoring that they were merged before. */
export function offersMergingAgain(request: MergeRequest): boolean {
  return offersIgnoreMergeTracking(request) && !request.ignoreMergeTracking;
}

/**
 * What a merge with nothing to merge offers: to apply the changes again ignoring merge tracking where `cm` can,
 * or, once options are set, to go back to the merge without them (a chosen ancestor can leave nothing to merge).
 */
export function nothingToMergeAction(request: MergeRequest): 'mergeAgain' | 'withoutOptions' | null {
  if (offersMergingAgain(request)) return 'mergeAgain';
  return hasMergeOptions(request) ? 'withoutOptions' : null;
}

export function withoutMergeOptions(request: MergeRequest): MergeRequest {
  const { ignoreMergeTracking: _ignored, ancestorSpec: _ancestor, ...rest } = request;
  return rest;
}

export function withIgnoreMergeTracking(request: MergeRequest, ignore: boolean): MergeRequest {
  const { ignoreMergeTracking: _ignored, ...rest } = request;
  return ignore ? { ...rest, ignoreMergeTracking: true } : rest;
}

/** The request merging from the given changeset as the common ancestor; null goes back to the one calculated. */
export function withAncestor(request: MergeRequest, changesetId: number | null): MergeRequest {
  const { ancestorSpec: _ancestor, ...rest } = request;
  return changesetId === null ? rest : { ...rest, ancestorSpec: spec.changeset(changesetId) };
}

export function ancestorLabel(request: MergeRequest): string {
  const id = request.ancestorSpec?.replace(/^cs:/, '');
  return id ? `Changeset ${id}` : 'Calculated automatically';
}

/** The contributor choices, named as the merge names its sides: "Keep yours" in a workspace, "Keep destination" into a branch. */
export function contributorSegments(labels: MergeLabels): { value: Contributor; label: string; title: string }[] {
  const { destination, source } = labels.roles;
  return [
    { value: 'both', label: 'Merge both', title: 'Merge both versions, automatically where they can be' },
    { value: 'destination', label: `Keep ${destination.name.toLowerCase()}`, title: `Keep ${destination.version} of every conflicting file` },
    { value: 'source', label: `Keep ${source.name.toLowerCase()}`, title: `Keep ${source.version} of every conflicting file` },
  ];
}

/**
 * The contributor the files' decisions amount to: both while the user decided none, a side when every file keeps it
 * whole, and null when they were decided differently. Files open in a merge tool are left out: the tool settles them.
 */
export function contributorOf(files: readonly ContributorFile[]): Contributor | null {
  const settleable = files.filter((file) => !file.openTool);
  if (settleable.every((file) => !file.decidedByUser)) return 'both';
  const [first] = settleable;
  const side = first?.decidedByUser && first.decision?.kind === 'wholeFile' ? first.decision.side : null;
  if (side !== 'source' && side !== 'destination') return null;
  return settleable.every((file) => file.decidedByUser && file.decision?.kind === 'wholeFile' && file.decision.side === side) ? side : null;
}

/** What choosing a contributor does to each file, but those open in a merge tool. */
export function contributorDecisions(files: readonly ContributorFile[], contributor: Contributor): ContributorDecision[] {
  const settleable = files.filter((file) => !file.openTool);
  if (contributor === 'both') return settleable.filter((file) => file.decidedByUser).map((file) => ({ key: file.file.key, decision: null }));
  return settleable.map((file) => ({ key: file.file.key, decision: { kind: 'wholeFile', side: contributor } }));
}
