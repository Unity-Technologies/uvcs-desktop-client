import { describe, expect, it } from 'vitest';
import type { TrackerConnection } from '@shared/domain/issueTrackers';
import { issueReferenceReader } from '@shared/issueTrackers/issueReferences';
import { editorState } from './commentEditorTesting';
import { editorIssueKeys } from './editorIssueKeys';
import { withIssueReferences } from './issueReferencesFacet';

const jira: TrackerConnection = { id: 'c1', kind: 'jiraDataCenter', server: 'https://jira.acme.com', account: { id: 'a', name: 'Ana' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const tracked = withIssueReferences(issueReferenceReader({ repository: 'game@acme@unity', connectionId: 'c1', projects: ['VCS'] }, jira));

describe('editorIssueKeys', () => {
  it('names the issues the text being written holds, typed or pasted as an address, each once, so they read at once', () => {
    expect(editorIssueKeys(editorState('Fixes VCS-13\nhttps://jira.acme.com/browse/VCS-12 and VCS-13‸', tracked))).toEqual(['VCS-12', 'VCS-13']);
  });

  it('names none where the place has no tracker, nor in code', () => {
    expect(editorIssueKeys(editorState('Fixes VCS-13‸'))).toEqual([]);
    expect(editorIssueKeys(editorState('`VCS-13`‸', tracked))).toEqual([]);
  });
});
