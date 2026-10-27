import { describe, expect, it } from 'vitest';
import { SHELL_ARGS } from './shellCommandLine';

describe('cm shell', () => {
  it('reads UTF-8, names the app for its usage events and sends no pings of its own: the app pings once (UsageEvents)', () => {
    expect(SHELL_ARGS).toEqual(['shell', '--encoding=utf-8', '--application=UVCSDesktop', '--nopingevents']);
  });
});
