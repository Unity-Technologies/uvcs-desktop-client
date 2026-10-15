import { describe, expect, it } from 'vitest';
import { parseAccounts } from './accounts';
import { serverProfiles } from './profiles';
import { formatOutput } from './testing/cmOutput';

describe('serverProfiles', () => {
  it('puts the local server first and drops wildcard and duplicate profiles', () => {
    const accounts = parseAccounts(
      formatOutput(['*@cloud_me', '*@cloud', 'me', 'SSOWorkingMode']) +
        formatOutput(['acme@cloud_me', 'acme@cloud', 'me', 'SSOWorkingMode']) +
        formatOutput(['acme@cloud_other', 'acme@cloud', 'other', 'SSOWorkingMode']) +
        formatOutput(['local', 'local', '', '']),
    );

    expect(serverProfiles(accounts).map((profile) => profile.server)).toEqual(['local', 'acme@cloud']);
  });
});
