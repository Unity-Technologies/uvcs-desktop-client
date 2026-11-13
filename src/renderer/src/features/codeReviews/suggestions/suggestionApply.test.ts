import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { CHECK_IN_TIP, factsWithoutWorkspace, reviewBranchOf, suggestionApplyButtonOf, suggestionApplyOf, suggestionCheckinComment, suggestionTargetIn, type SuggestionApplyFacts } from './suggestionApply';
import { FAILED, READING, readValue, type SuggestedChange } from './suggestedChange';

const CHANGE: SuggestedChange = { path: 'Assets/Scripts/Settings.cs', revisionId: 37, firstLine: 3, lastLine: 3, lines: ['    int Timeout = 60;'] };
const COMMENTED = 'class Settings\r\n{\r\n    int Timeout = 30;\r\n}\r\n';
const text = (value: string): FileContent => ({ text: value, isBinary: false, size: value.length });

const READY: SuggestionApplyFacts = {
  open: true,
  workspacePath: '/work/game',
  workspaceBranch: readValue('/main/task'),
  reviewBranch: readValue('/main/task'),
  behind: null,
  commentedText: readValue(COMMENTED),
  workspaceFile: readValue(text(COMMENTED)),
  pending: false,
};

const reasonOf = (facts: Partial<SuggestionApplyFacts>, change: SuggestedChange = CHANGE): string | undefined => {
  const apply = suggestionApplyOf(change, { ...READY, ...facts });
  return apply.kind === 'unavailable' ? apply.reason : undefined;
};

describe('suggestionApplyOf', () => {
  it('is ready at the line on the review branch, to check in alone', () => {
    expect(suggestionApplyOf(CHANGE, READY)).toEqual({ kind: 'ready', range: { firstLine: 3, lastLine: 3 }, commentedText: COMMENTED, checkIn: {} });
  });

  it('follows the line to where it is in the workspace now', () => {
    const moved = `// header\r\n${COMMENTED}`;
    expect(suggestionApplyOf(CHANGE, { ...READY, workspaceFile: readValue(text(moved)) })).toMatchObject({ kind: 'ready', range: { firstLine: 4, lastLine: 4 } });
  });

  it('offers nothing for a request applied or discarded', () => {
    expect(suggestionApplyOf(CHANGE, { ...READY, open: false })).toEqual({ kind: 'none' });
  });

  it('says why it can\'t be applied away from the review branch', () => {
    expect(reasonOf({ workspacePath: null })).toBe("Open a workspace on the review's branch to apply it");
    expect(reasonOf({ reviewBranch: readValue(null) })).toBe("A shelve's review: its changes are on no branch to apply them to");
    expect(reasonOf({ workspaceBranch: readValue('/main') })).toBe("Your workspace isn't on /main/task: switch to it to apply this");
    expect(reasonOf({ workspaceBranch: readValue(null) })).toBe("Your workspace isn't on /main/task: switch to it to apply this");
    expect(reasonOf({ behind: { count: 2, countCapped: false, authors: ['ana'] } })).toBe('Your workspace is behind /main/task: update it first');
  });

  it('waits for what it reads, and says when the branch can\'t be told', () => {
    expect(reasonOf({ reviewBranch: READING })).toBe('Checking your workspace…');
    expect(reasonOf({ workspaceFile: READING })).toBe('Checking your workspace…');
    expect(reasonOf({ commentedText: READING })).toBe('Checking your workspace…');
    expect(reasonOf({ reviewBranch: FAILED })).toBe("Couldn't tell which branch the review is on");
    expect(reasonOf({ workspaceBranch: FAILED })).toBe("Couldn't tell which branch your workspace is on");
  });

  it("says when the file isn't there, or isn't UTF-8 text it can write back as it was", () => {
    expect(reasonOf({ workspaceFile: FAILED })).toBe("Settings.cs isn't in your workspace");
    expect(reasonOf({ workspaceFile: readValue({ isBinary: true, size: 3 }) })).toBe("Settings.cs isn't a text file this can change");
    expect(reasonOf({ workspaceFile: readValue({ isBinary: false, tooLarge: 'text', size: 9e6 }) })).toBe("Settings.cs isn't a text file this can change");
    expect(reasonOf({ workspaceFile: readValue(text('caf\uFFFD')) })).toBe("Settings.cs isn't a text file this can change");
  });

  it('says when the line no longer holds the text the suggestion was written on', () => {
    expect(reasonOf({ workspaceFile: readValue(text(COMMENTED.replace('30', '45'))) })).toBe('Line 3 changed since the suggestion was written');
  });

  it("says so, apart, when the version the suggestion was written on can't be read or isn't text", () => {
    expect(reasonOf({ commentedText: FAILED })).toBe("The code the suggestion was written on can't be read");
    expect(reasonOf({ commentedText: readValue(null) })).toBe("Settings.cs wasn't a text file when the suggestion was written");
  });

  it("reads a file whose text is the word 'failed' as text", () => {
    expect(reasonOf({ commentedText: readValue('failed\n'), workspaceFile: readValue(text('failed\n')) }, { ...CHANGE, firstLine: 1, lastLine: 1 })).toBeUndefined();
  });

  it('applies to the changes, but checks in nothing, when the file has other changes a check-in would take', () => {
    expect(suggestionApplyOf(CHANGE, { ...READY, pending: true })).toMatchObject({
      kind: 'ready',
      checkIn: { reason: 'Settings.cs has other changes, which a check-in of it would take too: apply it to your changes' },
    });
  });
});

describe('suggestionApplyOf on a range of lines', () => {
  const BLOCK: SuggestedChange = { ...CHANGE, firstLine: 2, lastLine: 4, lines: ['{ int Timeout = 60; }'] };

  it('is ready where the whole block is, moved or not', () => {
    expect(suggestionApplyOf(BLOCK, { ...READY, workspaceFile: readValue(text(`// a\r\n// b\r\n${COMMENTED}`)) })).toMatchObject({ kind: 'ready', range: { firstLine: 4, lastLine: 6 } });
  });

  it('says the lines changed when any line of the block did, or a line went in between', () => {
    expect(reasonOf({ workspaceFile: readValue(text(COMMENTED.replace('{', '{ // open'))) }, BLOCK)).toBe('Lines 2–4 changed since the suggestion was written');
    expect(reasonOf({ workspaceFile: readValue(text(COMMENTED.replace('{\r\n', '{\r\n    // new\r\n'))) }, BLOCK)).toBe('Lines 2–4 changed since the suggestion was written');
  });
});

describe('suggestionTargetIn', () => {
  it('refuses a line repeated elsewhere (a lone brace) whose neighbors no longer hold it, rather than writing at the wrong one', () => {
    const brace: SuggestedChange = { ...CHANGE, firstLine: 3, lastLine: 3, lines: ['} // Run'] };
    const commented = 'void Run() {\n  step();\n}\n';
    const moved = 'void Run() {\n}\n  step();\n';
    expect(suggestionTargetIn(brace, commented, text(moved))).toEqual({ kind: 'refused', reason: 'Line 3 changed since the suggestion was written' });
  });

  it('takes the block where its neighbors still hold it, code added further above', () => {
    const brace: SuggestedChange = { ...CHANGE, firstLine: 3, lastLine: 3, lines: ['} // Run'] };
    const commented = 'void Run() {\n  step();\n}\n';
    const added = 'void Walk() {\n}\n\nvoid Run() {\n  step();\n}\n';
    expect(suggestionTargetIn(brace, commented, text(added))).toMatchObject({ kind: 'ready', range: { firstLine: 6, lastLine: 6 } });
  });

  it('rechecks a fresh read of the file as the button did', () => {
    expect(suggestionTargetIn(CHANGE, COMMENTED, text(COMMENTED))).toEqual({ kind: 'ready', text: COMMENTED, range: { firstLine: 3, lastLine: 3 } });
    expect(suggestionTargetIn(CHANGE, COMMENTED, text(COMMENTED.replace('30', '31')))).toEqual({ kind: 'refused', reason: 'Line 3 changed since the suggestion was written' });
    expect(suggestionTargetIn(CHANGE, COMMENTED, 'failed')).toEqual({ kind: 'refused', reason: "Settings.cs isn't in your workspace" });
  });
});

describe('suggestionCheckinComment', () => {
  it('names who suggested it, and in its description the change request it applies', () => {
    expect(suggestionCheckinComment('ana.diaz@acme.com', 'C0D1CE00-1111-2222-3333-444455556666')).toBe('Apply suggestion from Ana Diaz\n\n[apply-change:c0d1ce00]');
  });
});

describe('reviewBranchOf', () => {
  it("is a branch review's branch, a changeset review's changeset's, and none for a shelve", () => {
    expect(reviewBranchOf({ kind: 'branch', branch: '/main/task' }, READING)).toEqual(readValue('/main/task'));
    expect(reviewBranchOf({ kind: 'changeset', changesetId: 12 }, readValue('/main'))).toEqual(readValue('/main'));
    expect(reviewBranchOf({ kind: 'changeset', changesetId: 12 }, READING)).toEqual(READING);
    expect(reviewBranchOf({ kind: 'shelve', shelveId: 3 }, readValue('/main'))).toEqual(readValue(null));
    expect(reviewBranchOf({ kind: 'unknown', description: '?' }, readValue('/main'))).toEqual(FAILED);
  });
});

describe('suggestionApplyButtonOf', () => {
  it('shows nothing for a settled request', () => {
    expect(suggestionApplyButtonOf({ kind: 'none' }).shown).toBe(false);
  });

  it('is off whole, saying why, when it can\'t be applied', () => {
    expect(suggestionApplyButtonOf({ kind: 'unavailable', reason: 'Your workspace is behind /main/task: update it first' })).toEqual({
      shown: true,
      disabled: true,
      mainDisabled: true,
      tip: 'Your workspace is behind /main/task: update it first',
    });
  });

  it('checks in, or only applies to the changes when the file has others', () => {
    const ready = suggestionApplyOf(CHANGE, READY);
    expect(suggestionApplyButtonOf(ready)).toEqual({ shown: true, disabled: false, mainDisabled: false, tip: CHECK_IN_TIP });
    expect(suggestionApplyButtonOf(suggestionApplyOf(CHANGE, { ...READY, pending: true }))).toEqual({
      shown: true,
      disabled: false,
      mainDisabled: true,
      tip: 'Settings.cs has other changes, which a check-in of it would take too: apply it to your changes',
    });
  });
});

describe('factsWithoutWorkspace', () => {
  it('says to open a workspace, and offers nothing for a settled request', () => {
    expect(suggestionApplyOf(CHANGE, factsWithoutWorkspace(true))).toEqual({ kind: 'unavailable', reason: "Open a workspace on the review's branch to apply it" });
    expect(suggestionApplyOf(CHANGE, factsWithoutWorkspace(false))).toEqual({ kind: 'none' });
  });
});
