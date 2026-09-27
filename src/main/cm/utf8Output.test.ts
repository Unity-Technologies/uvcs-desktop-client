import { describe, expect, it } from 'vitest';
import { printsInConsoleCodePage, withUtf8Output } from './utf8Output';

describe('printsInConsoleCodePage', () => {
  it('is what cm prints as text, not as XML, find output asked in UTF-8 or a file cat writes', () => {
    expect(printsInConsoleCodePage(['diff', 'cs:3', '--format={path}'])).toBe(true);
    expect(printsInConsoleCodePage(['merge', 'br:/main/task', '--machinereadable'])).toBe(true);
    expect(printsInConsoleCodePage(['status', '--xml', '--encoding=utf-8'])).toBe(false);
    expect(printsInConsoleCodePage(['diff', 'cs:3', '--xml'])).toBe(false);
    expect(printsInConsoleCodePage(withUtf8Output(['find', 'branch', '--format={name}']))).toBe(false);
    expect(printsInConsoleCodePage(['cat', 'revid:3', '--file=/tmp/a'])).toBe(false);
  });
});

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
