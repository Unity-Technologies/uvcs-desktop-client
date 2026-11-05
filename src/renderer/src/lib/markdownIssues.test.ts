import { describe, expect, it } from 'vitest';
import type { TrackerConnection } from '@shared/domain/issueTrackers';
import { issueReferenceReader } from '@shared/issueTrackers/issueReferences';
import { findReferences } from './comments/commentReferences';
import { commentLineInlines } from './comments/commentHeading';
import { parseMarkdown, type MarkdownInline } from './markdown';

const jira: TrackerConnection = { id: 'c1', kind: 'jiraCloud', server: 'https://x.atlassian.net', account: { id: 'a', name: 'Ana' }, signInMethod: 'token', access: 'read', credential: 'kept' };
const issues = issueReferenceReader({ repository: 'game@acme@unity', connectionId: 'c1', projects: ['VCS'] }, jira);
const github = issueReferenceReader({ repository: 'game@acme@unity', connectionId: 'c2', projects: ['acme/game'] }, { ...jira, id: 'c2', kind: 'github', server: 'https://github.com', scope: '*' });

const issue = (key: string, source: string, bare = false): MarkdownInline => ({ kind: 'reference', reference: { kind: 'issue', key, bare }, source });
const paragraph = (text: string, reader = issues) => {
  const [block] = parseMarkdown(text, { comment: true, issues: reader });
  return block?.kind === 'paragraph' ? block.children : [];
};

describe('a comment’s issues', () => {
  it('reads the bound project’s keys, never another project’s or in code', () => {
    expect(paragraph('Fixes VCS-12 and ABC-3, not `VCS-4`')).toEqual([
      { kind: 'text', text: 'Fixes ' },
      issue('VCS-12', 'VCS-12'),
      { kind: 'text', text: ' and ABC-3, not ' },
      { kind: 'code', text: 'VCS-4' },
    ]);
  });

  it('reads nothing with no tracker bound', () => {
    expect(parseMarkdown('Fixes VCS-12', { comment: true })).toEqual([{ kind: 'paragraph', children: [{ kind: 'text', text: 'Fixes VCS-12' }] }]);
  });

  it('leaves a key another reference already reads to it', () => {
    expect(findReferences('br:/main/VCS-12', issues).map((found) => found.reference.kind)).toEqual(['branch']);
  });

  it('takes a bare address of an issue’s page as the issue, from the link itself, ending before the sentence', () => {
    expect(paragraph('(see https://x.atlassian.net/browse/VCS-12).')).toEqual([
      { kind: 'text', text: '(see ' },
      issue('VCS-12', 'https://x.atlassian.net/browse/VCS-12'),
      { kind: 'text', text: ').' },
    ]);
    expect(paragraph('<https://x.atlassian.net/browse/VCS-12>')).toEqual([issue('VCS-12', '<https://x.atlassian.net/browse/VCS-12>')]);
  });

  it('leaves a link with its own text a link, its key unread', () => {
    expect(paragraph('[the bug](https://x.atlassian.net/browse/VCS-12)')).toEqual([{ kind: 'link', url: 'https://x.atlassian.net/browse/VCS-12', children: [{ kind: 'text', text: 'the bug' }] }]);
  });

  it('leaves an address that only holds a key in its query an address', () => {
    for (const address of ['https://x.atlassian.net/secure/Dashboard.jspa?issue=VCS-12', 'https://x.atlassian.net/jira/boards/1?selectedIssue=VCS-12', 'https://y.atlassian.net/browse/VCS-12', 'https://x.atlassian.net/browse/OPS-1']) {
      expect(paragraph(address)).toEqual([{ kind: 'link', url: address, children: [{ kind: 'text', text: address }] }]);
    }
  });

  it('reads GitHub’s `#12` and `owner/repo#12`, keeping the source as written', () => {
    expect(paragraph('Fixes #12 and Acme/Tools#3', github)).toEqual([
      { kind: 'text', text: 'Fixes ' },
      issue('acme/game#12', '#12', true),
      { kind: 'text', text: ' and ' },
      issue('acme/tools#3', 'Acme/Tools#3'),
    ]);
  });

  it('reads a row’s issues too', () => {
    expect(commentLineInlines('VCS-12: fix the layout', issues)).toEqual([issue('VCS-12', 'VCS-12'), { kind: 'text', text: ': fix the layout' }]);
  });
});
