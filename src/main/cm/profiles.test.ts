import { describe, expect, it } from 'vitest';
import { parseProfiles } from './profiles';

const record = (...fields: string[]): string => `${fields.join('\u001f')}\u001e\n`;

describe('parseProfiles', () => {
  it('puts the local server first and drops wildcard and duplicate profiles', () => {
    const output =
      record('*@cloud', 'me', 'SSOWorkingMode') +
      record('acme@cloud', 'me', 'SSOWorkingMode') +
      record('acme@cloud', 'other', 'SSOWorkingMode') +
      record('local', '', '');

    expect(parseProfiles(output).map((profile) => profile.server)).toEqual(['local', 'acme@cloud']);
  });
});
