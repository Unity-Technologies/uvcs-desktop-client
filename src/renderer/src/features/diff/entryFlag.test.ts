import { MessageSquare } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { entryFlagChip } from './entryFlag';

const entry = (path: string): DiffEntry => ({ status: 'changed', path, itemType: 'file', baseRevisionId: 10, revisionId: 30, repository: 'game@local' });
const markOf = (file: DiffEntry): string | null => (file.path === 'src/Player.cs' ? '2 comments' : null);

describe('entryFlagChip', () => {
  it('offers a chip named by the flag, holding the files it marks', () => {
    const chip = entryFlagChip({ icon: MessageSquare, filterLabel: 'Commented' }, markOf);
    expect(chip?.label).toBe('Commented');
    expect([entry('src/Player.cs'), entry('src/Enemy.cs')].filter(chip!.holds).map((file) => file.path)).toEqual(['src/Player.cs']);
  });

  it('offers none where the place names no chip', () => {
    expect(entryFlagChip({ icon: MessageSquare }, markOf)).toBeUndefined();
  });
});
