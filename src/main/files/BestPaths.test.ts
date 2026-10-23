import { describe, expect, it } from 'vitest';
import { BestPaths } from './BestPaths';

const file = (path: string) => ({ path, isDirectory: false });

describe('BestPaths', () => {
  it('keeps the best matches as the renderer ranks them: the name first, then the shorter', () => {
    const best = new BestPaths('player', 10);
    for (const path of ['Assets/Scripts/PlayerController.cs', 'Docs/player.md', 'Assets/Player.cs', 'Assets/Enemy.cs', 'Assets/play/er.txt']) best.offer(file(path));

    expect(best.take().map((item) => item.path)).toEqual(['Docs/player.md', 'Assets/Player.cs', 'Assets/Scripts/PlayerController.cs', 'Assets/play/er.txt']);
  });

  it('keeps only `limit` of them however many paths go past', () => {
    const best = new BestPaths('a', 3);
    for (let index = 0; index < 1000; index++) best.offer(file(`folder${index}/a${index}.txt`));

    expect(best.take()).toHaveLength(3);
  });

  it('says whether the best changed since they were last taken', () => {
    const best = new BestPaths('readme', 2);
    expect(best.offer(file('README.md'))).toBe(true);
    expect(best.changed).toBe(true);
    best.take();
    expect(best.offer(file('src/main.ts'))).toBe(false);
    expect(best.changed).toBe(false);
  });

  it('matches nothing for an empty query', () => {
    const best = new BestPaths('  ', 5);
    expect(best.offer(file('README.md'))).toBe(false);
    expect(best.take()).toEqual([]);
  });
});
