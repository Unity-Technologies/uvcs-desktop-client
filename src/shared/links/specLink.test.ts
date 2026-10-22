import { describe, expect, it } from 'vitest';
import { specLink } from './specLink';

describe('specLink', () => {
  it.each([
    ['cs:4207@game@acme@unity', { kind: 'repository', server: 'acme@unity', repository: 'game', object: { kind: 'changeset', id: 4207 } }],
    ['br:/main/task@game@host:8087', { kind: 'repository', server: 'host:8087', repository: 'game', object: { kind: 'branch', name: '/main/task' } }],
    ['lb:v1.2@game@local', { kind: 'repository', server: 'local', repository: 'game', object: { kind: 'label', name: 'v1.2' } }],
    ['sh:12@game@acme@unity', { kind: 'repository', server: 'acme@unity', repository: 'game', object: { kind: 'shelve', id: 12 } }],
    ['sh:-12@game@acme@unity', { kind: 'repository', server: 'acme@unity', repository: 'game', object: { kind: 'shelve', id: 12 } }],
    ['br:/main@rep:game@repserver:ssl://host:8088', { kind: 'repository', server: 'ssl://host:8088', repository: 'game', object: { kind: 'branch', name: '/main' } }],
    [' CS:7@game@local ', { kind: 'repository', server: 'local', repository: 'game', object: { kind: 'changeset', id: 7 } }],
  ])('reads %s', (text, link) => {
    expect(specLink(text)).toEqual(link);
  });

  // Which repository a bare spec means depends on where it was copied.
  it.each(['cs:4207', 'br:/main', 'cs:x@game@local', 'revid:3@game@local', 'game@local'])('reads no link in %s', (text) => {
    expect(specLink(text)).toBeNull();
  });
});
