import { describe, expect, it } from 'vitest';
import { workspaceToReturnTo } from './workspaceToReturnTo';

const galaxy = { name: 'galaxy-racer', path: '/ws/galaxy', guid: 'g1' };
const space = { name: 'space-racer', path: '/ws/space', guid: 'g2' };

describe('workspaceToReturnTo', () => {
  it('is the workspace the window left, as cm lists it', () => {
    expect(workspaceToReturnTo('/ws/galaxy', [space, galaxy])).toBe(galaxy);
  });

  it('is none when the window left none, or while the list is read', () => {
    expect(workspaceToReturnTo(null, [galaxy])).toBeNull();
    expect(workspaceToReturnTo('/ws/galaxy', undefined)).toBeNull();
  });

  it("is none once cm no longer lists it: its folder is gone, or it was deleted", () => {
    expect(workspaceToReturnTo('/ws/galaxy', [space])).toBeNull();
  });
});
