import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { diffedChange, metaDiffRequestedFor } from './changesMetaDiff';

const request = { workspacePath: '/wk/game', path: 'Assets/Player.png' };

describe('metaDiffRequestedFor', () => {
  it("is asked for the asset's change of its workspace only", () => {
    expect(metaDiffRequestedFor(request, '/wk/game', 'Assets/Player.png')).toBe(true);
    expect(metaDiffRequestedFor(request, '/wk/game', 'Assets/Enemy.png')).toBe(false);
    expect(metaDiffRequestedFor(request, '/wk/tools', 'Assets/Player.png')).toBe(false);
    expect(metaDiffRequestedFor(null, '/wk/game', 'Assets/Player.png')).toBe(false);
  });
});

describe('diffedChange', () => {
  const asset = { path: 'Assets/Player.png' } as PendingChange;
  const meta = { path: 'Assets/Player.png.meta' } as PendingChange;

  it("shows the meta's diff only while it is asked for the asset shown", () => {
    expect(diffedChange(asset, meta, 'Assets/Player.png')).toBe(meta);
    expect(diffedChange(asset, meta, 'Assets/Enemy.png')).toBe(asset);
    expect(diffedChange(asset, meta, null)).toBe(asset);
  });

  it('shows the asset when it has no meta listed', () => {
    expect(diffedChange(asset, undefined, 'Assets/Player.png')).toBe(asset);
  });
});
