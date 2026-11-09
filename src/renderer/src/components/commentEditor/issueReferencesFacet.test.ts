import { describe, expect, it } from 'vitest';
import type { TrackerConnection } from '@shared/domain/issueTrackers';
import { issueReferenceReader } from '@shared/issueTrackers/issueReferences';
import { editorState } from './commentEditorTesting';
import { issueReferencesChanged, withIssueReferences } from './issueReferencesFacet';
import { referencesIn } from './liveMarks';

const jira: TrackerConnection = { id: 'c1', kind: 'jiraCloud', server: 'https://x.atlassian.net', account: { id: 'a', name: 'Ana' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const reader = issueReferenceReader({ repository: 'game@acme@unity', connectionId: 'c1', projects: ['VCS'] }, jira);

describe('the editor’s issue chips', () => {
  it('reads the place’s issue keys as references, with a tracker', () => {
    const state = editorState('Fixes VCS-12 and cs:4 ‸', withIssueReferences(reader));
    expect(referencesIn(state, 0, state.doc.length, { revealsSelection: true }).map(({ source, reference }) => [source, reference.kind])).toEqual([
      ['VCS-12', 'issue'],
      ['cs:4', 'changeset'],
    ]);
  });

  it('reads none without one', () => {
    const state = editorState('Fixes VCS-12 ‸', withIssueReferences(undefined));
    expect(referencesIn(state, 0, state.doc.length, { revealsSelection: true })).toEqual([]);
  });

  it('draws the chips again when the place’s tracker changes', () => {
    const before = editorState('VCS-12', withIssueReferences(undefined));
    const after = editorState('VCS-12', withIssueReferences(reader));
    expect(issueReferencesChanged(before, after)).toBe(true);
    expect(issueReferencesChanged(before, before)).toBe(false);
  });
});
