import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import { findReferences } from '../../lib/comments/commentReferences';
import {
  branchIndex,
  branchSuggestions,
  changesetIndex,
  changesetSuggestions,
  emojiSuggestions,
  labelIndex,
  labelSuggestions,
  objectReferenceText,
  personIndex,
  personSuggestions,
} from './suggestionItems';

const PLACE = 'game@acme@unity';

function changeset(id: number, comment: string): Changeset {
  return { id, comment, guid: '', branch: '/main', owner: 'ana', date: '2026-10-01', parent: id - 1, repository: 'game' };
}

function branch(name: string, date: string, comment = ''): Branch {
  return { id: 1, name, parent: '/main', comment, owner: 'tom', date, headChangeset: 1, guid: '', repository: 'game' };
}

function label(name: string): Label {
  return { id: 1, name, changeset: 1, branch: '/main', comment: '', owner: 'tom', date: '2026-10-01', repository: 'game' };
}

describe('changeset suggestions', () => {
  const index = changesetIndex([changeset(4207, 'Fix **the switch**\n\nMore'), changeset(4206, 'Faster startup'), changeset(1420, 'Old')]);

  it('find a changeset by its number, then by its comment', () => {
    expect(changesetSuggestions(index, '42').map((suggestion) => suggestion.label)).toEqual(['4207', '4206', '1420']);
    expect(changesetSuggestions(index, 'switch').map((suggestion) => suggestion.insert)).toEqual(['cs:4207']);
  });

  it('show the comment’s first line as text, and who made it', () => {
    expect(changesetSuggestions(index, '4207')[0]).toEqual({ key: 'cs:4207', kind: 'changeset', label: '4207', detail: 'Fix the switch', owner: 'ana', insert: 'cs:4207' });
  });
});

describe('branch suggestions', () => {
  const index = branchIndex([branch('/main', '2026-01-01'), branch('/main/task-2210', '2026-10-01', 'The task'), branch('/main/release', '2026-09-01')]);

  it('find a branch by its name, with or without its leading slash, or its last part; newest first', () => {
    expect(branchSuggestions(index, 'main', PLACE).map((suggestion) => suggestion.label)).toEqual(['/main/task-2210', '/main/release', '/main']);
    expect(branchSuggestions(index, '/main/t', PLACE).map((suggestion) => suggestion.label)).toEqual(['/main/task-2210']);
    expect(branchSuggestions(index, 'task', PLACE).map((suggestion) => suggestion.insert)).toEqual(['br:/main/task-2210']);
  });

  it('write a name a spec can’t hold as its link, which shows as the same chip', () => {
    const [suggestion] = branchSuggestions(branchIndex([branch('/main/my task', '2026-10-01')]), 'my', PLACE);
    expect(suggestion!.insert).toBe('uvcs://acme.unity/repos/game/branches/main/my%20task');
    expect(findReferences(suggestion!.insert)).toMatchObject([{ reference: { kind: 'link', link: { object: { kind: 'branch', name: '/main/my task' } } } }]);
  });
});

describe('objectReferenceText', () => {
  it('writes a spec for a name it holds whole', () => {
    expect(objectReferenceText({ kind: 'branch', name: '/main/task-2210' }, PLACE)).toBe('br:/main/task-2210');
    expect(objectReferenceText({ kind: 'label', name: 'v1.4.0' }, PLACE)).toBe('lb:v1.4.0');
  });

  it('writes a link for a space, or a sentence’s punctuation or an emphasis mark at the end', () => {
    expect(objectReferenceText({ kind: 'label', name: 'Release 2' }, PLACE)).toBe('uvcs://acme.unity/repos/game/labels/Release%202');
    expect(objectReferenceText({ kind: 'label', name: 'v1.' }, PLACE)).toMatch(/^uvcs:\/\//);
    expect(objectReferenceText({ kind: 'branch', name: '/main/task_' }, PLACE)).toMatch(/^uvcs:\/\//);
  });

  it('writes the spec while the repository isn’t known yet', () => {
    expect(objectReferenceText({ kind: 'label', name: 'Release 2' }, undefined)).toBe('lb:Release 2');
  });
});

describe('label suggestions', () => {
  it('find a label by its name', () => {
    expect(labelSuggestions(labelIndex([label('v1.4.0'), label('nightly')]), 'v1', PLACE).map((suggestion) => suggestion.insert)).toEqual(['lb:v1.4.0']);
  });
});

describe('person suggestions', () => {
  const index = personIndex(['ana.diaz@acme.com', 'ACME\\tom', 'ana.diaz@acme.com', 'Ana Diaz']);

  it('find a person by the name shown or as cm names them, and mention them as cm names them', () => {
    expect(personSuggestions(index, 'ana')).toEqual([
      { key: '@ana.diaz@acme.com', kind: 'person', label: 'Ana Diaz', detail: 'ana.diaz@acme.com', person: 'ana.diaz@acme.com', insert: '@ana.diaz@acme.com' },
    ]);
    expect(personSuggestions(index, 'tom').map((suggestion) => suggestion.insert)).toEqual(['@ACME\\tom']);
  });

  it('leaves out a name a mention can’t hold whole', () => {
    expect(personSuggestions(index, 'diaz').map((suggestion) => suggestion.person)).toEqual(['ana.diaz@acme.com']);
  });
});

describe('emoji suggestions', () => {
  it('find an emoji by the start of its name first, then by its tags', () => {
    const found = emojiSuggestions('tad');
    expect(found[0]).toEqual({ key: ':tada:', kind: 'emoji', label: ':tada:', detail: 'party popper', glyph: '🎉', insert: ':tada:' });
  });

  it('write the name typed when an emoji has several', () => {
    expect(emojiSuggestions('thumbsu')[0]?.insert).toBe(':thumbsup:');
    expect(emojiSuggestions('+1')[0]?.insert).toBe(':+1:');
  });

  it('show the best few only', () => {
    expect(emojiSuggestions('sm').length).toBe(8);
  });
});
