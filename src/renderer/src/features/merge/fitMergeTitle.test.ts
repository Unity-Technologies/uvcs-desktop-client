import { describe, expect, it } from 'vitest';
import { fitMergeTitle } from './fitMergeTitle';

const measure = (text: string): number => text.length;
const title = { verb: 'Merge', source: '/main/a/b/c/task', preposition: 'into', destination: '/main/a/b/c' };
const fixed = 'Merge  into  '.length;

describe('fitMergeTitle', () => {
  it('keeps the whole title when it fits', () => {
    expect(fitMergeTitle(title, 100, measure)).toBe(title);
  });

  it('drops folders from the middle of the wider branch first', () => {
    expect(fitMergeTitle(title, fixed + 23, measure)).toMatchObject({ verb: 'Merge', preposition: 'into', source: '/main/…/task', destination: '/main/a/b/c' });
  });

  it('shortens both when one alone is not enough, down to the names', () => {
    const long = { ...title, destination: '/main/a/b/c/other' };
    expect(fitMergeTitle(long, fixed + 26, measure)).toMatchObject({ source: '/main/…/task', destination: '/main/…/other' });
    expect(fitMergeTitle(long, fixed + 5, measure)).toMatchObject({ source: '…/task', destination: '…/other' });
  });

  it('never makes a short branch longer', () => {
    expect(fitMergeTitle({ ...title, destination: '/main' }, fixed + 1, measure).destination).toBe('/main');
  });
});
