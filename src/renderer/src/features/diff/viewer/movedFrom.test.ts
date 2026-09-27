import { describe, expect, it } from 'vitest';
import { movedFrom } from './movedFrom';

describe('movedFrom', () => {
  it('names only the old name of a file renamed in its folder', () => {
    expect(movedFrom('src/renamed.ts', 'src/torename.ts')).toBe('torename.ts');
    expect(movedFrom('renamed.ts', 'old.ts')).toBe('old.ts');
  });

  it('names the old path of a file moved to another folder', () => {
    expect(movedFrom('lib/tomove.ts', 'src/tomove.ts')).toBe('src/tomove.ts');
    expect(movedFrom('src/deeper/app.ts', 'src/app.ts')).toBe('src/app.ts');
    expect(movedFrom('app.ts', 'src/app.ts')).toBe('src/app.ts');
  });
});
