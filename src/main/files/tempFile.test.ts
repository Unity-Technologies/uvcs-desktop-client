import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempPath } from './tempFile';

describe('temporary directories', () => {
  it('are named with the process that owns them', async () => {
    const directory = await withTempPath(async (path) => basename(dirname(path)));
    expect(directory).toMatch(new RegExp(`^uvcs-${process.pid}-`));
  });
});
