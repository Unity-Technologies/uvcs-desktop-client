import { describe, expect, it } from 'vitest';
import { programPlaceholder } from './programPlaceholder';

describe('programPlaceholder', () => {
  it('writes a Windows path with its drive and backslashes, and a Unix one elsewhere', () => {
    expect(programPlaceholder('win32')).toBe('C:\\Program Files\\Tool\\tool.exe');
    expect(programPlaceholder('darwin')).toBe('/path/to/tool');
    expect(programPlaceholder('linux')).toBe('/path/to/tool');
  });
});
