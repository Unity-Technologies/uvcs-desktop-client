import { MessageSquare } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { entryFlagChip, withMetaMarks } from './entryFlag';

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

describe('withMetaMarks', () => {
  const asset = entry('Art/Hero.png');
  const meta = entry('Art/Hero.png.meta');
  const other = entry('src/Enemy.cs');
  const metaOf = (file: DiffEntry): DiffEntry | undefined => (file === asset ? meta : undefined);

  it("marks an asset's row for its .meta too, the row the meta rides on", () => {
    const marks = withMetaMarks((file) => (file === meta ? '1 comment' : null), metaOf);
    expect(marks(asset)).toBe('1 comment on its .meta');
  });

  it("says both when the asset and its .meta are marked", () => {
    const marks = withMetaMarks((file) => (file === asset ? '2 comments' : file === meta ? '1 comment' : null), metaOf);
    expect(marks(asset)).toBe('2 comments, 1 comment on its .meta');
  });

  it('leaves the other rows as the place marks them', () => {
    const marks = withMetaMarks((file) => (file === other ? '3 comments' : null), metaOf);
    expect(marks(other)).toBe('3 comments');
    expect(marks(asset)).toBeNull();
  });
});
