import { describe, expect, it } from 'vitest';
import { findReferences } from '../../lib/comments/commentReferences';
import { chipCard, chipContent, chipName, emojiLabel, personCard, referenceRepository, type ChipContent } from './chipContent';

const chipOf = (text: string, placeRepository?: string): ChipContent => chipContent(findReferences(text)[0]!.reference, placeRepository);

describe('chipContent', () => {
  it('names each object by its own name or number, in words in its title, and opens it', () => {
    expect(chipOf('cs:4207')).toEqual({
      kind: 'object',
      icon: 'changeset',
      label: '4207',
      title: 'Changeset 4207',
      target: { object: { kind: 'changeset', id: 4207 } },
      cachedAs: { kind: 'changeset', id: 4207 },
    });
    expect(chipOf('br:/main/task-2210')).toEqual({
      kind: 'object',
      icon: 'branch',
      label: 'task-2210',
      title: 'Branch /main/task-2210',
      target: { object: { kind: 'branch', name: '/main/task-2210' } },
      cachedAs: { kind: 'branch', name: '/main/task-2210' },
    });
    expect(chipOf('lb:v1.4.0')).toMatchObject({ icon: 'label', label: 'v1.4.0', title: 'Label v1.4.0' });
    expect(chipOf('sh:12')).toMatchObject({ icon: 'shelve', label: '12', title: 'Shelve 12', target: { object: { kind: 'shelve', id: 12 } } });
    expect(chipOf('cr:311')).toMatchObject({ icon: 'codeReview', label: '311', title: 'Code review 311', target: { object: { kind: 'codeReview', id: 311 } } });
  });

  it('names the repository of an object in another one, and opens it there', () => {
    expect(chipOf('cs:12@art@acme@unity')).toEqual({
      kind: 'object',
      icon: 'changeset',
      label: '12',
      title: 'Changeset 12',
      repository: 'art',
      target: { repository: 'art@acme@unity', object: { kind: 'changeset', id: 12 } },
    });
  });

  it("reads an object of the place's repository as its own, however it's written", () => {
    const local = { kind: 'object', icon: 'changeset', label: '12', title: 'Changeset 12', target: { object: { kind: 'changeset', id: 12 } }, cachedAs: { kind: 'changeset', id: 12 } };
    expect(chipOf('cs:12@game@acme@unity', 'game@acme@unity')).toEqual(local);
    expect(chipOf('cs:12@game', 'game@acme@unity')).toEqual(local);
    expect(chipOf('uvcs://acme@unity/repos/game/changesets/12', 'game@acme@unity')).toEqual(local);
    expect(chipOf('cs:12@art', 'game@acme@unity')).toMatchObject({ repository: 'art', target: { repository: 'art' } });
  });

  it("shows a file by its name, and opens its object's diff on it", () => {
    expect(chipOf('serverpath:/src/Player.cs#cs:12')).toEqual({
      kind: 'object',
      icon: 'file',
      label: 'Player.cs',
      title: '/src/Player.cs at changeset 12',
      target: { object: { kind: 'changeset', id: 12 }, page: { kind: 'diffFile', path: '/src/Player.cs' } },
    });
  });

  it('shows a link as what it opens', () => {
    expect(chipOf('uvcs://acme@unity/repos/game/branches/main/task')).toEqual({
      kind: 'object',
      icon: 'branch',
      label: 'task',
      title: 'Branch /main/task',
      repository: 'game',
      target: { repository: 'game@acme@unity', object: { kind: 'branch', name: '/main/task' } },
    });
    expect(chipOf('uvcs://acme@unity/repos/game/changesets/12/-/files/src/a.cs')).toMatchObject({ icon: 'file', label: 'a.cs', title: '/src/a.cs in changeset 12' });
    expect(chipOf('uvcs://acme@unity/repos/game/-/changesets')).toMatchObject({ icon: 'link', label: 'game' });
  });

  it('shows people and emoji as themselves', () => {
    expect(chipOf('@ana@acme.com')).toEqual({ kind: 'user', name: 'ana@acme.com' });
    expect(chipOf(':tada:')).toEqual({ kind: 'emoji', glyph: '🎉', name: 'tada' });
  });
});

describe('referenceRepository', () => {
  it("opens an object in the repository it names, on the place's server when it names none, else the place's", () => {
    expect(referenceRepository({ repository: 'art@acme@unity' }, 'game@local')).toBe('art@acme@unity');
    expect(referenceRepository({ repository: 'art' }, 'game@acme@unity')).toBe('art@acme@unity');
    expect(referenceRepository({}, 'game@acme@unity')).toBe('game@acme@unity');
  });
});

describe('chipCard', () => {
  const ago = (date: string) => `ago(${date})`;

  it('leads with the comment read, then what the object is, who made it and when, as the Branch Explorer’s card', () => {
    expect(chipCard({ title: 'Changeset 4' }, { comment: 'Merge **cr:44**\n\nMore', owner: 'daniel.penalba@unity3d.com', date: '2026-10-28' }, ago)).toEqual({
      comment: 'Merge **cr:44**\n\nMore',
      title: 'Changeset 4',
      meta: ['Changeset 4', 'Daniel Penalba', 'ago(2026-10-28)'],
    });
  });

  it('takes a review’s title and status', () => {
    expect(chipCard({ title: 'Code review 44' }, { title: 'Review the switch', status: 'Under review', owner: 'ana', date: '2026-10-01' }, ago)).toEqual({
      comment: 'Review the switch',
      title: 'Code review 44',
      meta: ['Code review 44', 'Under review', 'Ana', 'ago(2026-10-01)'],
    });
  });

  it('says what the object is alone while nothing read it, and its repository when another', () => {
    expect(chipCard({ title: 'Changeset 12' }, undefined, ago)).toEqual({ title: 'Changeset 12', meta: [] });
    expect(chipCard({ title: 'Changeset 12', repository: 'art' }, undefined, ago)).toEqual({ title: 'Changeset 12', meta: ['In art'] });
  });

  it('says another repository has no such object, or couldn’t be read from, in place of where it is', () => {
    expect(chipCard({ title: 'Changeset 1201', repository: 'art' }, undefined, ago, { kind: 'missing' })).toEqual({ title: 'Changeset 1201', meta: ['No changeset 1201 in art'] });
    expect(chipCard({ title: 'Label v2', repository: 'art' }, undefined, ago, { kind: 'missing' })).toEqual({ title: 'Label v2', meta: ['No label v2 in art'] });
    expect(chipCard({ title: 'Changeset 4', repository: 'art' }, undefined, ago, { kind: 'unreadable' })).toEqual({ title: 'Changeset 4', meta: ["Couldn't read it from art"] });
  });

  it('names the server of a repository on one the user doesn’t work with, which is never read', () => {
    expect(chipCard({ title: 'Changeset 4', repository: 'art' }, undefined, ago, { kind: 'unknownServer', server: 'attacker.example.com:8087' })).toEqual({
      title: 'Changeset 4',
      meta: ['In art on attacker.example.com:8087, not a server you use'],
    });
  });

  it('leaves out what an object read has no word for', () => {
    expect(chipCard({ title: 'Label v1' }, { comment: '', owner: 'ana' }, ago)).toEqual({ title: 'Label v1', meta: ['Ana'] });
  });
});

describe('personCard', () => {
  it('names a person as shown, then as cm knows them', () => {
    expect(personCard('daniel.penalba@unity3d.com')).toEqual({ title: 'Daniel Penalba', meta: ['daniel.penalba@unity3d.com'] });
  });

  it('says the name once when both read the same', () => {
    expect(personCard('ana')).toEqual({ title: 'Ana', meta: [] });
  });
});

describe('emojiLabel', () => {
  it("reads an emoji's name as words", () => {
    expect(emojiLabel('white_check_mark')).toBe('white check mark');
  });
});

describe('chipName', () => {
  it('reads a chip aloud as it shows, its summary after its name, a pause between', () => {
    expect(chipName('Changeset 4', 'Merge request fixes')).toBe('Changeset 4, Merge request fixes');
    expect(chipName('Changeset 4', undefined)).toBe('Changeset 4');
  });
});
