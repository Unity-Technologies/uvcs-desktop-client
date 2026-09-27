import { describe, expect, it } from 'vitest';
import { withUtf8Output } from './utf8Output';

describe('withUtf8Output', () => {
  it('asks the commands that can print UTF-8 to do so: find always, the others with --xml', () => {
    expect(withUtf8Output(['find', 'branch', '--format={name}', '--nototal'])).toEqual(['find', 'branch', '--format={name}', '--nototal', '--encoding=utf-8']);
    expect(withUtf8Output(['status', '--xml', '--changelists'])).toEqual(['status', '--xml', '--changelists', '--encoding=utf-8']);
    expect(withUtf8Output(['history', '/wk/a', '--xml', '--symlink'])).toEqual(['history', '/wk/a', '--xml', '--symlink', '--encoding=utf-8']);
  });

  it('leaves commands whose output it does not change, and an encoding already asked for', () => {
    expect(withUtf8Output(['status', '--machinereadable'])).toEqual(['status', '--machinereadable']);
    expect(withUtf8Output(['diff', 'cs:3', '--format={path}'])).toEqual(['diff', 'cs:3', '--format={path}']);
    expect(withUtf8Output(['find', 'branch', '--xml', '--encoding=utf-16'])).toEqual(['find', 'branch', '--xml', '--encoding=utf-16']);
  });
});
