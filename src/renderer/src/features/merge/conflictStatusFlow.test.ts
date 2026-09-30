import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { mergeLabels } from './mergeDescription';
import { conflictStatusOf, describeChange, fileConflictStatus, fileConflictTool, planProgress, presentStatus, summarizePlan } from './mergeStatus';
import { chosenConflictChoice, decisionFor } from './resolve/conflictChoices';
import type { FileConflictDecision } from './resolve/fileConflictDecision';
import { buildStates } from './resolve/fileConflictStates';
import type { FileConflictState } from './resolve/useFileConflicts';

/**
 * A conflicting file from its three versions to where the merge stands: its state (`buildStates`), its status and how
 * it reads (`fileConflictStatus`, `presentStatus`), the choice shown picked (`chosenConflictChoice`) and whether the
 * merge can complete (`planProgress`).
 */

const workspace = mergeLabels({ kind: 'merge', sourceSpec: 'br:/main/task' }, undefined);
const serverBranch = mergeLabels({ kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' }, undefined);
const vsCode = { sessionId: 's1', toolName: 'VS Code', canBringToFront: true };

const text = (value: string): FileContent => ({ text: value, isBinary: false, size: value.length });
const binary: FileContent = { isBinary: true, size: 3 };

// Both sides changed line b; only the destination changed line d.
const BASE = text('a\nb\nc\nd\n');
const SOURCE = text('a\nS\nc\nd\n');
const DESTINATION = text('a\nD\nc\nD2\n');
// Each side changed a different line.
const CLEAN_SOURCE = text('a\nb\nc\nS\n');
const CLEAN_DESTINATION = text('D\nb\nc\nd\n');

interface FileSetup {
  versions?: { data?: FileContent; error?: Error }[];
  decision?: FileConflictDecision;
  openTool?: typeof vsCode;
}

function stateOf({ versions = [{ data: BASE }, { data: SOURCE }, { data: DESTINATION }], decision, openTool }: FileSetup = {}): FileConflictState {
  const file = { key: '/app.ts', path: 'app.ts', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } } as const;
  const inputs = { file, versions: versions.map((version) => ({ data: version.data, error: version.error ?? null })), decision, openTool };
  return buildStates([inputs], workspace, new Map()).states[0]!;
}

const reads = (state: FileConflictState, labels = workspace): string => presentStatus(fileConflictStatus(state), labels, fileConflictTool(state)).label;
const blocksCompletion = (state: FileConflictState): boolean => planProgress([fileConflictStatus(state)]) !== 'Ready to merge';
const conflicted = stateOf();
const document = conflicted.document!;

describe('a conflicting file, as the merge page shows it', () => {
  it('needs a decision while the automatic merge left conflicts, and holds the merge back', () => {
    expect(reads(conflicted)).toBe('Needs your decision');
    expect(conflicted.remainingConflicts).toBe(1);
    expect(blocksCompletion(conflicted)).toBe(true);
    expect(planProgress([fileConflictStatus(conflicted), fileConflictStatus(conflicted)])).toBe('2 conflicts to decide');
  });

  it('merges automatically when both sides changed different places, needing nothing', () => {
    const clean = stateOf({ versions: [{ data: BASE }, { data: CLEAN_SOURCE }, { data: CLEAN_DESTINATION }] });
    expect(reads(clean)).toBe('Will merge automatically');
    expect(clean.resolution).toEqual({ choice: 'text', text: 'D\nb\nc\nS\n' });
    expect(blocksCompletion(clean)).toBe(false);
  });

  it('reads as the user decided once they keep a whole version', () => {
    const keptYours = stateOf({ decision: decisionFor('destination', document) });
    expect(reads(keptYours)).toBe('Keeping yours');
    expect(chosenConflictChoice(fileConflictStatus(keptYours), keptYours.decision, document)).toBe('destination');
    expect(blocksCompletion(keptYours)).toBe(false);
    expect(reads(stateOf({ decision: decisionFor('destination', document) }), serverBranch)).toBe('Keeping destination');
  });

  it('reads as keeping a side when the conflicts picked add up to that version', () => {
    const pickedIncoming = stateOf({ decision: { kind: 'text', text: SOURCE.text! } });
    expect(reads(pickedIncoming)).toBe('Keeping incoming');
    expect(chosenConflictChoice(fileConflictStatus(pickedIncoming), pickedIncoming.decision, document)).toBe('source');
  });

  it('reads as combined when it keeps both sides, and shows Both picked', () => {
    const both = stateOf({ decision: decisionFor('both', document) });
    expect(reads(both)).toBe('Combined');
    expect(chosenConflictChoice(fileConflictStatus(both), both.decision, document)).toBe('both');
  });

  it('reads as edited by the user once typed by hand, and still waits while markers are left', () => {
    const edited = stateOf({ decision: { kind: 'text', text: 'a\nmine\nc\nD2\n', edited: true } });
    expect(reads(edited)).toBe('Edited by you');
    expect(chosenConflictChoice(fileConflictStatus(edited), edited.decision, document)).toBe('byHand');

    const markersLeft = stateOf({ decision: { kind: 'text', text: document.text, edited: true } });
    expect(markersLeft.resolution).toBeNull();
    expect(reads(markersLeft)).toBe('Needs your decision');
  });

  it('is no longer automatic once the user overrides an automatic merge by keeping one version', () => {
    const overridden = stateOf({ versions: [{ data: BASE }, { data: CLEAN_SOURCE }, { data: CLEAN_DESTINATION }], decision: { kind: 'wholeFile', side: 'source' } });
    expect(overridden.mergedAutomatically).toBe(false);
    expect(reads(overridden)).toBe('Keeping incoming');
  });

  it('waits for the merge tool it is open in, whatever was decided before, and reads as resolved there once saved', () => {
    const open = stateOf({ decision: decisionFor('destination', document), openTool: vsCode });
    expect(open.resolution).toBeNull();
    expect(reads(open)).toBe('Open in VS Code…');
    expect(blocksCompletion(open)).toBe(true);

    const saved = stateOf({ decision: { kind: 'text', text: 'a\nmerged\nc\nD2\n', tool: 'VS Code' } });
    expect(reads(saved)).toBe('Resolved in VS Code');
    expect(blocksCompletion(saved)).toBe(false);
  });

  it('holds the merge back while its versions are read or when one can not be', () => {
    const reading = stateOf({ versions: [{ data: BASE }, {}, { data: DESTINATION }] });
    expect(reads(reading)).toBe('Reading…');
    expect(blocksCompletion(reading)).toBe(true);

    const unreadable = stateOf({ versions: [{ data: BASE }, { error: new Error('revision not found') }, {}] });
    expect(reads(unreadable)).toBe("Can't read");
    expect(blocksCompletion(unreadable)).toBe(true);
  });

  it('leaves a binary unmerged, waiting for one of its versions to be kept', () => {
    const image = stateOf({ versions: [{ data: binary }, { data: binary }, { data: binary }] });
    expect(image).toMatchObject({ isBinary: true, mergedAutomatically: false, resolution: null });
    expect(reads(image)).toBe('Needs your decision');
    expect(reads(stateOf({ versions: [{ data: binary }, { data: binary }, { data: binary }], decision: { kind: 'wholeFile', side: 'source' } }))).toBe('Keeping incoming');
  });
});

describe('where the whole merge stands', () => {
  it('counts every conflict, saying how many wait for the user', () => {
    const statuses = [conflicted, stateOf({ decision: decisionFor('both', document) }), stateOf({ openTool: vsCode })].map(fileConflictStatus);
    expect(summarizePlan(12, statuses)).toBe('12 changes to apply · 3 conflicts: 1 decided, 2 need your decision');
    expect(planProgress(statuses)).toBe('2 conflicts to decide');
  });

  it('gives changes that apply cleanly no conflict status, and words them as what will happen', () => {
    expect(conflictStatusOf({ kind: 'change', key: 'change:0', change: { kind: 'changed', path: '/a.ts' } })).toBeNull();
    expect(describeChange({ kind: 'changed', path: '/a.ts' }, workspace)).toBe('Will be changed: only the incoming side changed it');
    expect(describeChange({ kind: 'deleted', path: '/a.ts' }, serverBranch)).toBe('Will be deleted: deleted on the source side');
    expect(describeChange({ kind: 'moved', path: '/b.ts' }, workspace)).toBe('Will be moved');
    expect(describeChange({ kind: 'permissions', path: '/run.sh' }, workspace)).toBe('Its file permissions will change');
  });
});
