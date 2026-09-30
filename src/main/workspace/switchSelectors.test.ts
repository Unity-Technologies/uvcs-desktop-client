import { describe, expect, it } from 'vitest';
import { selectorSpec } from '@shared/domain/specs';
import { bringDisabledReason, describeSelector, leaveDisabledReason, parseSelectorSpec } from './switchSelectors';

describe('parseSelectorSpec', () => {
  it('reads the kind, name and repository of a spec', () => {
    expect(parseSelectorSpec('br:/main/t2')).toEqual({ selector: { kind: 'branch', name: '/main/t2' }, repositoryName: undefined });
    expect(parseSelectorSpec('lb:v1@other@local')).toEqual({ selector: { kind: 'label', name: 'v1' }, repositoryName: 'other' });
    expect(parseSelectorSpec('/main/t3').selector).toEqual({ kind: 'branch', name: '/main/t3' });
  });

  it('round-trips with selectorSpec', () => {
    expect(selectorSpec(parseSelectorSpec('cs:12').selector)).toBe('cs:12');
  });
});

describe('describeSelector', () => {
  it('shows branches by name and the rest by kind', () => {
    expect(describeSelector({ kind: 'branch', name: '/main/t1' })).toBe('/main/t1');
    expect(describeSelector({ kind: 'changeset', name: '42' })).toBe('changeset 42');
  });
});

describe('bringDisabledReason', () => {
  it('allows bringing changes to branches and changesets of the same repository', () => {
    expect(bringDisabledReason('br:/main/t2', 'swx')).toBeUndefined();
    expect(bringDisabledReason('cs:4@swx@local', 'swx')).toBeUndefined();
  });

  it('refuses labels, shelves and other repositories', () => {
    expect(bringDisabledReason('lb:v1', 'swx')).toBe('label');
    expect(bringDisabledReason('sh:3', 'swx')).toBe('shelve');
    expect(bringDisabledReason('br:/main@other@local', 'swx')).toBe('otherRepository');
  });
});

describe('leaveDisabledReason', () => {
  it('lets changes stay behind anywhere but on a shelve', () => {
    expect(leaveDisabledReason({ kind: 'branch', name: '/main' })).toBeUndefined();
    expect(leaveDisabledReason({ kind: 'label', name: 'v1' })).toBeUndefined();
    expect(leaveDisabledReason({ kind: 'shelve', name: '4' })).toBe('shelveSource');
  });
});
