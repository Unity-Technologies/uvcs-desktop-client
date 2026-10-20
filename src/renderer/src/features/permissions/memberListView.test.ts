import { describe, expect, it } from 'vitest';
import { NO_BITS, type AclLevel, type ObjectPermissions } from '@shared/domain/permissions';
import { memberAfterKey, memberListView } from './memberListView';
import { memberRows } from './members';
import { EMPTY_DRAFT } from './permissionsDraft';

const permissionsNaming = (members: string[]): ObjectPermissions => {
  const acl: AclLevel = {
    creator: 'br:/main/task@rep:game@repserver:local',
    entries: members.map((member) => ({ member, bits: { ...NO_BITS, allowed: ['read'] } })),
    inherited: [],
  };
  return { acl, ownAcl: true, owner: null };
};
const rowsNaming = (members: string[]) => memberRows(permissionsNaming(members), EMPTY_DRAFT, new Set());
const names = (rows: { member: { name: string } }[]) => rows.map((row) => row.member.name);

const few = rowsNaming(['ana', 'bea', 'carla']);
const many = rowsNaming(['ana', 'anabel', 'bea', 'carla', 'dani', 'eva', 'fran', 'gus', 'hugo']);

describe('the list of users and groups', () => {
  it('shows its filter only past eight entries', () => {
    expect(memberListView(rowsNaming(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), undefined, '').filters).toBe(false);
    expect(memberListView(many, undefined, '').filters).toBe(true);
  });

  it('keeps the rows matching every word of the filter, in their order', () => {
    expect(names(memberListView(many, undefined, 'ana').shown)).toEqual(['ana', 'anabel']);
    expect(names(memberListView(many, undefined, '').shown)).toEqual(names(many));
  });

  it('finds the selected row and where it shows', () => {
    const view = memberListView(many, 'anabel', 'ana');

    expect(view.selectedRow?.member.name).toBe('anabel');
    expect(view.selectedIndex).toBe(1);
  });

  it('has no selected row when nothing is selected', () => {
    const view = memberListView(few, undefined, '');

    expect(view.selectedRow).toBeUndefined();
    expect(view.selectedIndex).toBe(-1);
  });

  it('moves the selection with the arrows and pages, stopping at the ends', () => {
    expect(memberAfterKey(memberListView(few, 'ana', ''), 'ArrowDown')).toBe('bea');
    expect(memberAfterKey(memberListView(few, 'bea', ''), 'ArrowUp')).toBe('ana');
    expect(memberAfterKey(memberListView(few, 'carla', ''), 'ArrowDown')).toBe('carla');
    expect(memberAfterKey(memberListView(few, 'ana', ''), 'PageDown')).toBe('carla');
  });

  it('lets other keys through, and every key when no row shows', () => {
    expect(memberAfterKey(memberListView(few, 'ana', ''), 'a')).toBeUndefined();
    expect(memberAfterKey(memberListView(many, 'ana', 'zzz'), 'ArrowDown')).toBeUndefined();
  });

  it('drops its filter once the list is short enough to hide the field, so no row stays hidden', () => {
    const view = memberListView(rowsNaming(['ana', 'bea', 'carla']), undefined, 'ana');

    expect(view.filters).toBe(false);
    expect(view.query).toBe('');
    expect(names(view.shown)).toEqual(['ana', 'bea', 'carla']);
  });

  it('acts on no row while the filter hides the selected one', () => {
    const view = memberListView(many, 'bea', 'ana');

    expect(view.selectedRow).toBeUndefined();
  });

  it('goes to the first row shown when the selected one is hidden', () => {
    expect(memberAfterKey(memberListView(many, 'bea', 'ana'), 'ArrowDown')).toBe('ana');
  });
});
