import { describe, expect, it } from 'vitest';
import { memberListing, pickerFooter, type MemberListing } from './serverMembers';

const listed = (names: string[]): MemberListing => ({ names, listFailed: false, loading: false });
const refused: MemberListing = { names: [], listFailed: true, loading: false };

describe('memberListing', () => {
  it('offers the whole list once read, and nothing yet while it is read', () => {
    expect(memberListing({ everyone: { data: ['ana'], failed: false, loading: false }, searched: { fetching: false } })).toEqual(listed(['ana']));
    expect(memberListing({ everyone: { failed: false, loading: true }, searched: { fetching: false } })).toEqual({ names: [], listFailed: false, loading: true });
  });

  it('offers what the search found where the server refused the whole list, loading only while it searches', () => {
    expect(memberListing({ everyone: { failed: true, loading: false }, searched: { data: ['Artists'], fetching: false } })).toEqual({ names: ['Artists'], listFailed: true, loading: false });
    expect(memberListing({ everyone: { failed: true, loading: false }, searched: { fetching: true } })).toEqual({ names: [], listFailed: true, loading: true });
  });
});

describe('pickerFooter', () => {
  it('says nothing when both lists were read whole', () => {
    expect(pickerFooter(listed(['ana']), listed(['Artists']))).toBeUndefined();
  });

  it('asks for a name where the users can not all be listed', () => {
    expect(pickerFooter(refused, listed(['Artists']))).toBe('The server can’t list everyone: type a name to look it up.');
  });

  it('asks only for a group’s name where only the groups can not be listed', () => {
    expect(pickerFooter(listed(['ana']), refused)).toBe('The server can’t list its groups: type a group’s name to look it up.');
  });
});
