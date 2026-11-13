import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { factsWithoutWorkspace, reviewBranchOf, suggestionApplyOf, suggestionCheckinComment, type SuggestionApplyFacts } from './suggestionApply';
import type { SuggestedChange } from './suggestedChange';

const CHANGE: SuggestedChange = { path: 'Assets/Scripts/Settings.cs', revisionId: 37, firstLine: 3, lastLine: 3, lines: ['    int Timeout = 60;'] };
const COMMENTED = 'class Settings\r\n{\r\n    int Timeout = 30;\r\n}\r\n';
const text = (value: string): FileContent => ({ text: value, isBinary: false, size: value.length });

const READY: SuggestionApplyFacts = {
  open: true,
  workspacePath: '/work/game',
  workspaceBranch: '/main/task',
  reviewBranch: '/main/task',
  behind: null,
  commentedText: COMMENTED,
  workspaceFile: text(COMMENTED),
  pending: false,
};

const reasonOf = (facts: Partial<SuggestionApplyFacts>): string | undefined => {
  const apply = suggestionApplyOf(CHANGE, { ...READY, ...facts });
  return apply.kind === 'unavailable' ? apply.reason : undefined;
};

describe('suggestionApplyOf', () => {
  it('is ready at the line on the review branch, to check in alone', () => {
    expect(suggestionApplyOf(CHANGE, READY)).toEqual({ kind: 'ready', text: COMMENTED, firstLine: 3, lastLine: 3, checkIn: {} });
  });

  it('follows the line to where it is in the workspace now', () => {
    const moved = `// header\r\n${COMMENTED}`;
    expect(suggestionApplyOf(CHANGE, { ...READY, workspaceFile: text(moved) })).toMatchObject({ kind: 'ready', firstLine: 4, lastLine: 4 });
  });

  it('offers nothing for a request applied or discarded', () => {
    expect(suggestionApplyOf(CHANGE, { ...READY, open: false })).toEqual({ kind: 'none' });
  });

  it('says why it can\'t be applied away from the review branch', () => {
    expect(reasonOf({ workspacePath: null })).toBe("Open a workspace on the review's branch to apply it");
    expect(reasonOf({ reviewBranch: null })).toBe("A shelve's review: its changes are on no branch to apply them to");
    expect(reasonOf({ workspaceBranch: '/main' })).toBe("Your workspace isn't on /main/task: switch to it to apply this");
    expect(reasonOf({ workspaceBranch: null })).toBe("Your workspace isn't on /main/task: switch to it to apply this");
    expect(reasonOf({ behind: { count: 2, countCapped: false, authors: ['ana'] } })).toBe('Your workspace is behind /main/task: update it first');
  });

  it('waits for what it reads, and says when the branch can\'t be told', () => {
    expect(reasonOf({ reviewBranch: 'reading' })).toBe('Checking your workspace…');
    expect(reasonOf({ workspaceFile: 'reading' })).toBe('Checking your workspace…');
    expect(reasonOf({ commentedText: 'reading' })).toBe('Checking your workspace…');
    expect(reasonOf({ reviewBranch: 'failed' })).toBe("Couldn't tell which branch the review is on");
  });

  it("says when the file isn't there, or isn't UTF-8 text it can write back as it was", () => {
    expect(reasonOf({ workspaceFile: 'failed' })).toBe("Settings.cs isn't in your workspace");
    expect(reasonOf({ workspaceFile: { isBinary: true, size: 3 } })).toBe("Settings.cs isn't a text file this can change");
    expect(reasonOf({ workspaceFile: { isBinary: false, tooLarge: 'text', size: 9e6 } })).toBe("Settings.cs isn't a text file this can change");
    expect(reasonOf({ workspaceFile: text('caf�') })).toBe("Settings.cs isn't a text file this can change");
  });

  it('says when the line no longer holds the text the suggestion was written on', () => {
    expect(reasonOf({ workspaceFile: text(COMMENTED.replace('30', '45')) })).toBe('Line 3 changed since the suggestion was written');
    expect(reasonOf({ commentedText: 'failed' })).toBe('Line 3 changed since the suggestion was written');
  });

  it('applies to the changes, but checks in nothing, when the file has other changes a check-in would take', () => {
    expect(suggestionApplyOf(CHANGE, { ...READY, pending: true })).toMatchObject({
      kind: 'ready',
      checkIn: { reason: 'Settings.cs has other changes, which a check-in of it would take too: apply it to your changes' },
    });
  });
});

describe('suggestionCheckinComment', () => {
  it('names who suggested it, and in its description the change request it applies', () => {
    expect(suggestionCheckinComment('ana.diaz@acme.com', 'C0D1CE00-1111-2222-3333-444455556666')).toBe('Apply suggestion from Ana Diaz\n\n[apply-change:c0d1ce00]');
  });
});

describe('reviewBranchOf', () => {
  it("is a branch review's branch, a changeset review's changeset's, and none for a shelve", () => {
    expect(reviewBranchOf({ kind: 'branch', branch: '/main/task' }, 'reading')).toBe('/main/task');
    expect(reviewBranchOf({ kind: 'changeset', changesetId: 12 }, '/main')).toBe('/main');
    expect(reviewBranchOf({ kind: 'changeset', changesetId: 12 }, 'reading')).toBe('reading');
    expect(reviewBranchOf({ kind: 'shelve', shelveId: 3 }, '/main')).toBeNull();
    expect(reviewBranchOf({ kind: 'unknown', description: '?' }, '/main')).toBe('failed');
  });
});

describe('factsWithoutWorkspace', () => {
  it('says to open a workspace, and offers nothing for a settled request', () => {
    expect(suggestionApplyOf(CHANGE, factsWithoutWorkspace(true))).toEqual({ kind: 'unavailable', reason: "Open a workspace on the review's branch to apply it" });
    expect(suggestionApplyOf(CHANGE, factsWithoutWorkspace(false))).toEqual({ kind: 'none' });
  });
});
