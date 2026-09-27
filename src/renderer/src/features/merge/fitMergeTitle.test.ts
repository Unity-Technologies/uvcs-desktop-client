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

  it('cuts the middle of the names when even they are too wide, the wider first, and keeps the words', () => {
    const long = { verb: 'Merge', source: '/main/feature-with-a-long-name', preposition: 'into', destination: '/main' };
    const fitted = fitMergeTitle(long, fixed + 20, measure);
    expect(fitted).toMatchObject({ verb: 'Merge', preposition: 'into', destination: '/main' });
    expect(fitted.source).toBe('…/featur…g-name');
    expect(measure(fitted.source) + measure(fitted.destination)).toBeLessThanOrEqual(20);
  });

  it('shares the room when both names are too wide', () => {
    const both = { verb: 'Merge', source: '/main/aaaaaaaaaaaaaaaaaaaa', preposition: 'into', destination: '/main/bbbbbbbbbbbbbbbbbbbb' };
    const fitted = fitMergeTitle(both, fixed + 20, measure);
    expect(measure(fitted.source) + measure(fitted.destination)).toBeLessThanOrEqual(20);
    expect(fitted.source).toMatch(/^…\/a+…a+$/);
    expect(fitted.destination).toMatch(/^…\/b+…b+$/);
  });

  it('keeps a few characters each side of the cut however narrow the room', () => {
    const long = { verb: 'Merge', source: '/main/feature-with-a-long-name', preposition: 'into', destination: '/main' };
    expect(fitMergeTitle(long, fixed + 2, measure).source).toBe('…/fea…ame');
  });
});
