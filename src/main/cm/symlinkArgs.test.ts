import { describe, expect, it } from 'vitest';
import { onLinksThemselves } from './symlinkArgs';

describe('onLinksThemselves', () => {
  it('tells cm to act on a link rather than on the file it points to', () => {
    expect(onLinksThemselves('undo', '/wk/link')).toEqual(['undo', '/wk/link', '--symlink']);
    expect(onLinksThemselves('ls', '/wk/src', '--xml')).toEqual(['ls', '/wk/src', '--xml', '--symlink']);
  });
});
