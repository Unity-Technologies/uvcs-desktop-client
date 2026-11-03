import { describe, expect, it } from 'vitest';
import { metaDiffRequestedFor } from './changesMetaDiff';

const request = { workspacePath: '/wk/game', path: 'Assets/Player.png' };

describe('metaDiffRequestedFor', () => {
  it("is asked for the asset's change of its workspace only", () => {
    expect(metaDiffRequestedFor(request, '/wk/game', 'Assets/Player.png')).toBe(true);
    expect(metaDiffRequestedFor(request, '/wk/game', 'Assets/Enemy.png')).toBe(false);
    expect(metaDiffRequestedFor(request, '/wk/tools', 'Assets/Player.png')).toBe(false);
    expect(metaDiffRequestedFor(null, '/wk/game', 'Assets/Player.png')).toBe(false);
  });
});

