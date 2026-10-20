import { describe, expect, it } from 'vitest';
import { permissionsSaveButton } from './permissionsSave';

const idle = { changeCount: 0, saving: false, createsGroup: false, groupBranchCount: 0 };

describe('permissionsSaveButton', () => {
  it('waits for a change, saying so', () => {
    expect(permissionsSaveButton(idle)).toEqual({ enabled: false, label: 'Save', disabledReason: 'Nothing changed yet' });
  });

  it('saves the changes, counting them past one', () => {
    expect(permissionsSaveButton({ ...idle, changeCount: 1 })).toEqual({ enabled: true, label: 'Save', disabledReason: undefined });
    expect(permissionsSaveButton({ ...idle, changeCount: 3 })).toEqual({ enabled: true, label: 'Save 3 changes', disabledReason: undefined });
  });

  it('gives no reason while saving: the button shows it is busy', () => {
    expect(permissionsSaveButton({ ...idle, changeCount: 2, saving: true })).toEqual({ enabled: false, label: 'Save 2 changes', disabledReason: undefined });
  });

  it('waits for the branches of a new group to be named', () => {
    expect(permissionsSaveButton({ ...idle, changeCount: 2, createsGroup: true })).toMatchObject({ enabled: false, disabledReason: 'Name the branches of the new group first' });
    expect(permissionsSaveButton({ ...idle, changeCount: 2, createsGroup: true, groupBranchCount: 1 }).enabled).toBe(true);
  });
});
