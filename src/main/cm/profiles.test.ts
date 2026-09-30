import { describe, expect, it } from 'vitest';
import { parseProfiles } from './profiles';
import { formatOutput } from './testing/cmOutput';


describe('parseProfiles', () => {
  it('puts the local server first and drops wildcard and duplicate profiles', () => {
    const output =
      formatOutput(['*@cloud', 'me', 'SSOWorkingMode']) +
      formatOutput(['acme@cloud', 'me', 'SSOWorkingMode']) +
      formatOutput(['acme@cloud', 'other', 'SSOWorkingMode']) +
      formatOutput(['local', '', '']);

    expect(parseProfiles(output).map((profile) => profile.server)).toEqual(['local', 'acme@cloud']);
  });
});
