import { describe, expect, it } from 'vitest';
import type { DirectoryConflict } from '@shared/domain/merge';
import { directoryConflictIdentity } from './directoryConflictIdentity';

const divergentMove: DirectoryConflict = {
  type: 'divergentMove',
  title: 'Divergent move conflict',
  explanation: 'An item was moved on source and destination to two different locations.',
  itemId: 26,
  isDirectory: false,
  source: { operation: 'moved', path: '/src/div-src.txt', oldPath: '/src/div.txt', description: 'Moved from /src/div.txt to /src/div-src.txt' },
  destination: { operation: 'moved', path: '/src/div-dst.txt', oldPath: '/src/div.txt', description: 'Moved from /src/div.txt to /src/div-dst.txt' },
};

describe('directoryConflictIdentity', () => {
  it('stays the same for the same conflict listed again, and tells it from another', () => {
    const identity = directoryConflictIdentity(divergentMove);

    expect(directoryConflictIdentity({ ...divergentMove })).toBe(identity);
    expect(directoryConflictIdentity({ ...divergentMove, itemId: 27 })).not.toBe(identity);
    expect(directoryConflictIdentity({ ...divergentMove, destination: { ...divergentMove.destination, path: '/src/other.txt' } })).not.toBe(identity);
  });
});
