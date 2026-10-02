import { describe, expect, it } from 'vitest';
import { memberCandidates } from './memberCandidates';

describe('memberCandidates', () => {
  const sources = { users: ['zoe@corp.com', 'ana@corp.com'], groups: ['Web Devs', 'Admins'], specials: true, listed: new Set(['Admins']), search: '' };

  it('offers the special entries, then groups, then users, by name, telling those already listed', () => {
    expect(memberCandidates(sources).map((candidate) => [candidate.label, candidate.member.kind, candidate.listed])).toEqual([
      ['Owner', 'user', false],
      ['All users', 'group', false],
      ['Admins', 'group', true],
      ['Web Devs', 'group', false],
      ['ana@corp.com', 'user', false],
      ['zoe@corp.com', 'user', false],
    ]);
  });

  it('finds them by the words typed, in any order', () => {
    expect(memberCandidates({ ...sources, search: 'devs web' }).map((candidate) => candidate.label)).toEqual(['Web Devs']);
    expect(memberCandidates({ ...sources, search: 'all' }).map((candidate) => candidate.member.name)).toEqual(['ALL USERS']);
  });

  it('leaves the special entries out where only a real user or group fits', () => {
    expect(memberCandidates({ ...sources, specials: false }).map((candidate) => candidate.label)).toEqual(['Admins', 'Web Devs', 'ana@corp.com', 'zoe@corp.com']);
  });
});
