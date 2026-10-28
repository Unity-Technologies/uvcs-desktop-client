import { describe, expect, it } from 'vitest';
import { findReferences, type CommentReference } from './commentReferences';

const referencesIn = (text: string): CommentReference[] => findReferences(text).map((found) => found.reference);
const sourcesIn = (text: string): string[] => findReferences(text).map((found) => found.source);

describe('findReferences', () => {
  it('reads the objects cm names by spec', () => {
    expect(referencesIn('cs:4207 br:/main/task-2210 lb:v1.4.0 sh:12 cr:311')).toEqual([
      { kind: 'changeset', id: 4207 },
      { kind: 'branch', name: '/main/task-2210' },
      { kind: 'label', name: 'v1.4.0' },
      { kind: 'shelve', id: 12 },
      { kind: 'codeReview', id: 311 },
    ]);
  });

  it('says where each one is and how it was written', () => {
    expect(findReferences('Fixes cs:12, see br:main.')).toEqual([
      { reference: { kind: 'changeset', id: 12 }, source: 'cs:12', from: 6, to: 11 },
      { reference: { kind: 'branch', name: '/main' }, source: 'br:main', from: 17, to: 24 },
    ]);
  });

  it("adds the leading slash a branch's name may be written without, as cm does", () => {
    expect(referencesIn('br:main/task')).toEqual([{ kind: 'branch', name: '/main/task' }]);
  });

  it('reads the repository after the first @, as cm does', () => {
    expect(referencesIn('cs:12@game@acme@unity br:/main@rep:game@repserver:host:8087 lb:v1@game')).toEqual([
      { kind: 'changeset', id: 12, repository: 'game@acme@unity' },
      { kind: 'branch', name: '/main', repository: 'game@host:8087' },
      { kind: 'label', name: 'v1', repository: 'game' },
    ]);
  });

  it('leaves the punctuation that ends a sentence or a bracket out', () => {
    expect(sourcesIn('(see cs:12) and br:/main/task. Also lb:v1.2.0! sh:3?')).toEqual(['cs:12', 'br:/main/task', 'lb:v1.2.0', 'sh:3']);
  });

  it('reads a file at a changeset, branch, label or shelve', () => {
    expect(referencesIn('serverpath:/src/Player.cs#cs:12 serverpath:/a.txt#br:/main/task@game@local')).toEqual([
      { kind: 'file', path: '/src/Player.cs', at: { kind: 'changeset', id: 12 } },
      { kind: 'file', path: '/a.txt', at: { kind: 'branch', name: '/main/task' }, repository: 'game@local' },
    ]);
  });

  it('reads Unicode names', () => {
    expect(referencesIn('br:/main/tarea-año lb:версия-1')).toEqual([
      { kind: 'branch', name: '/main/tarea-año' },
      { kind: 'label', name: 'версия-1' },
    ]);
  });

  it('reads people by name, domain name or email address', () => {
    expect(referencesIn('@maria.lopez, @ACME\\tom and @ana@acme.com.')).toEqual([
      { kind: 'user', name: 'maria.lopez' },
      { kind: 'user', name: 'ACME\\tom' },
      { kind: 'user', name: 'ana@acme.com' },
    ]);
  });

  it('reads people named in any script', () => {
    expect(referencesIn('@josé.garcía and @Ñandú')).toEqual([
      { kind: 'user', name: 'josé.garcía' },
      { kind: 'user', name: 'Ñandú' },
    ]);
  });

  it('reads emoji by GitHub names, and only those', () => {
    expect(referencesIn(':tada: :+1: :not_an_emoji:')).toEqual([
      { kind: 'emoji', name: 'tada', glyph: '🎉' },
      { kind: 'emoji', name: '+1', glyph: '👍' },
    ]);
  });

  it('reads uvcs:// links to a repository object', () => {
    expect(referencesIn('See uvcs://acme@unity/repos/game/changesets/4188.')).toEqual([
      { kind: 'link', link: { kind: 'repository', server: 'acme@unity', repository: 'game', object: { kind: 'changeset', id: 4188 } } },
    ]);
  });

  it('reads nothing inside a word, a path, an address or a time', () => {
    expect(referencesIn('ana@acme.com /a/cs:1 x-cs:2 10:30:00 http://h/:tada: abc@def')).toEqual([]);
  });

  it('reads the prefixes as cm does, in lower case only', () => {
    expect(referencesIn('CS:12 Br:/main')).toEqual([]);
  });

  it('reads nothing a spec cannot hold', () => {
    expect(referencesIn('cs:abc sh:x cr: br:/ lb: cs:12@ serverpath:a.cs#cs:1 serverpath:/a.cs#cr:1')).toEqual([]);
  });
});
