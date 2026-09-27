import { describe, expect, it } from 'vitest';
import { explainLockedFile } from './lockedFile';

const errno = (code: string) => Object.assign(new Error(`${code}: something`), { code });

describe('explainLockedFile', () => {
  it('names the file another app keeps locked', () => {
    expect((explainLockedFile(errno('EBUSY'), 'report.xlsx') as Error).message).toBe('report.xlsx is open in another app that locks it. Close it there and try again.');
  });

  it('leaves every other error as it is', () => {
    const missing = errno('ENOENT');
    expect(explainLockedFile(missing, 'a.txt')).toBe(missing);
    expect(explainLockedFile('text', 'a.txt')).toBe('text');
  });
});
