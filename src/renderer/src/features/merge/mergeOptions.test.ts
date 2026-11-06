import { describe, expect, it } from 'vitest';
import type { MergeRequest } from '@shared/domain/merge';
import { mergeLabels } from './mergeDescription';
import {
  ancestorLabel,
  contributorDecisions,
  contributorOf,
  contributorSegments,
  hasMergeOptions,
  mergeOptionsOffered,
  nothingToMergeAction,
  offersMergingAgain,
  withAncestor,
  withIgnoreMergeTracking,
  withoutMergeOptions,
  type ContributorFile,
} from './mergeOptions';

const merge: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task' };
const cherryPick: MergeRequest = { kind: 'cherryPick', sourceSpec: 'cs:12' };

/** A conflicting file as the contributor choice sees it: undecided by the user unless said otherwise. */
function file(key: string, overrides: Partial<ContributorFile> = {}): ContributorFile {
  return { file: { key }, decidedByUser: false, ...overrides };
}

const inTool = { sessionId: 's', toolName: 'VS Code', canBringToFront: false };
const keptYours = (key: string) => file(key, { decidedByUser: true, decision: { kind: 'wholeFile', side: 'destination' } });
const keptIncoming = (key: string) => file(key, { decidedByUser: true, decision: { kind: 'wholeFile', side: 'source' } });

describe('mergeOptionsOffered', () => {
  it('offers the contributor only when files conflict', () => {
    expect(mergeOptionsOffered(merge, 0).contributor).toBe(false);
    expect(mergeOptionsOffered(merge, 2).contributor).toBe(true);
  });

  it('offers a common ancestor on a regular merge, and ignoring merge tracking on a cherry pick', () => {
    expect(mergeOptionsOffered(merge, 0)).toEqual({ contributor: false, ignoreMergeTracking: false, commonAncestor: true, any: true });
    expect(mergeOptionsOffered(cherryPick, 0)).toEqual({ contributor: false, ignoreMergeTracking: true, commonAncestor: false, any: true });
  });

  it('offers nothing to merge a shelve with no conflicting files', () => {
    expect(mergeOptionsOffered({ kind: 'merge', sourceSpec: 'sh:3' }, 0).any).toBe(false);
  });
});

describe('hasMergeOptions and withoutMergeOptions', () => {
  it('tells a request with options from one without, and takes them away', () => {
    expect(hasMergeOptions(merge)).toBe(false);
    expect(hasMergeOptions({ ...merge, ancestorSpec: 'cs:5' })).toBe(true);
    expect(hasMergeOptions({ ...cherryPick, ignoreMergeTracking: true })).toBe(true);
    expect(hasMergeOptions({ ...cherryPick, ignoreMergeTracking: false })).toBe(false);
    expect(hasMergeOptions({ ...merge, ignoreMergeTracking: true })).toBe(false);
    expect(withoutMergeOptions({ ...cherryPick, ignoreMergeTracking: true, ancestorSpec: 'cs:5' })).toEqual(cherryPick);
  });
});

describe('withIgnoreMergeTracking', () => {
  it('turns ignoring merge tracking on, and off again without leaving the field behind', () => {
    expect(withIgnoreMergeTracking(cherryPick, true)).toEqual({ ...cherryPick, ignoreMergeTracking: true });
    expect(withIgnoreMergeTracking({ ...cherryPick, ignoreMergeTracking: true }, false)).toEqual(cherryPick);
  });
});

describe('offersMergingAgain', () => {
  it('offers to apply already merged changes again where cm can ignore merge tracking, once', () => {
    expect(offersMergingAgain(cherryPick)).toBe(true);
    expect(offersMergingAgain({ ...cherryPick, ignoreMergeTracking: true })).toBe(false);
    expect(offersMergingAgain(merge)).toBe(false);
  });
});

describe('nothingToMergeAction', () => {
  it('offers to merge the changes again, ignoring merge tracking, where the merge can', () => {
    expect(nothingToMergeAction(cherryPick)).toEqual({ label: 'Merge them again', request: { ...cherryPick, ignoreMergeTracking: true } });
  });

  it('offers to go back to the merge without its options once they are set', () => {
    expect(nothingToMergeAction({ ...merge, ancestorSpec: 'cs:3' })).toEqual({ label: 'Merge without options', request: merge });
    expect(nothingToMergeAction({ ...cherryPick, ignoreMergeTracking: true })).toEqual({ label: 'Merge without options', request: cherryPick });
  });

  it('offers nothing to a merge with no options to change', () => {
    expect(nothingToMergeAction(merge)).toBeNull();
  });
});

describe('withAncestor and ancestorLabel', () => {
  it('names the chosen changeset, or the one calculated', () => {
    expect(ancestorLabel(merge)).toBe('Calculated automatically');
    expect(ancestorLabel(withAncestor(merge, 41))).toBe('Changeset 41');
    expect(withAncestor(merge, 41)).toEqual({ ...merge, ancestorSpec: 'cs:41' });
  });

  it('goes back to the calculated ancestor', () => {
    expect(withAncestor({ ...merge, ancestorSpec: 'cs:41' }, null)).toEqual(merge);
  });
});

describe('contributorSegments', () => {
  it("names each contributor as the merge names its sides", () => {
    expect(contributorSegments(mergeLabels(merge, undefined)).map((segment) => segment.label)).toEqual(['Merge both', 'Keep yours', 'Keep incoming']);
    const intoBranch = mergeLabels({ ...merge, destinationBranch: '/main' }, undefined);
    expect(contributorSegments(intoBranch).map((segment) => segment.label)).toEqual(['Merge both', 'Keep destination', 'Keep source']);
  });
});

describe('contributorOf', () => {
  it('is both while no file was decided by the user, and with no files at all', () => {
    expect(contributorOf([])).toBe('both');
    expect(contributorOf([file('a'), file('b', { decision: { kind: 'text', text: 'merged' } })])).toBe('both');
  });

  it('is the side every file keeps whole', () => {
    expect(contributorOf([keptYours('a'), keptYours('b')])).toBe('destination');
    expect(contributorOf([keptIncoming('a'), keptIncoming('b')])).toBe('source');
  });

  it('is none when the files were decided differently', () => {
    expect(contributorOf([keptYours('a'), file('b')])).toBeNull();
    expect(contributorOf([keptYours('a'), keptIncoming('b')])).toBeNull();
    expect(contributorOf([file('a', { decidedByUser: true, decision: { kind: 'text', text: 'by hand', edited: true } })])).toBeNull();
  });

  it('leaves out the files open in a merge tool, which the tool settles', () => {
    expect(contributorOf([keptIncoming('a'), file('b', { openTool: inTool })])).toBe('source');
  });
});

describe('contributorDecisions', () => {
  it('keeps one side of every file, but those open in a tool', () => {
    const files = [file('a'), keptYours('b'), file('c', { openTool: inTool })];
    expect(contributorDecisions(files, 'source')).toEqual([
      { key: 'a', decision: { kind: 'wholeFile', side: 'source' } },
      { key: 'b', decision: { kind: 'wholeFile', side: 'source' } },
    ]);
  });

  it('merging both starts over every file the user decided, back to the automatic merge', () => {
    const files = [file('a'), keptYours('b'), keptIncoming('c')];
    expect(contributorDecisions(files, 'both')).toEqual([
      { key: 'b', decision: null },
      { key: 'c', decision: null },
    ]);
  });
});
