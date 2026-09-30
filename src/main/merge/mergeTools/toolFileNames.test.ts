import { describe, expect, it } from 'vitest';
import { toolFileNames } from './toolFileNames';

describe('toolFileNames', () => {
  it('names each version after the file, keeping its extension for syntax', () => {
    expect(toolFileNames('src/app/main.ts')).toEqual({ base: 'main.BASE.ts', yours: 'main.YOURS.ts', incoming: 'main.INCOMING.ts', result: 'main.ts' });
    expect(toolFileNames('Makefile').base).toBe('Makefile.BASE');
    expect(toolFileNames('a/we"ird&name.txt').result).toBe('we_ird_name.txt');
  });
});
