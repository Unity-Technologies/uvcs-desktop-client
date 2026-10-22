import { describe, expect, it } from 'vitest';
import { lineFocusRequestFor } from './changesLineFocus';

const LINES = { side: 'new', first: 42, last: 42 } as const;
const request = { workspacePath: '/wk/game', path: 'Assets/Player.cs', lines: LINES };

describe('lineFocusRequestFor', () => {
  it("is the request's lines for its change of its workspace", () => {
    expect(lineFocusRequestFor(request, '/wk/game', 'Assets/Player.cs')).toEqual(LINES);
  });

  it("is nothing for another change, another workspace's same path, or no request", () => {
    expect(lineFocusRequestFor(request, '/wk/game', 'Assets/Enemy.cs')).toBeUndefined();
    expect(lineFocusRequestFor(request, '/wk/tools', 'Assets/Player.cs')).toBeUndefined();
    expect(lineFocusRequestFor(null, '/wk/game', 'Assets/Player.cs')).toBeUndefined();
  });
});
