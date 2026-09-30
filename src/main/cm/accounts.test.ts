import { describe, expect, it } from 'vitest';
import { parseAccounts } from './accounts';
import { formatOutput } from './testing/cmOutput';


describe('parseAccounts', () => {
  it('keeps every profile, wildcard ones included, with the name that deletes it', () => {
    const output =
      formatOutput(['*@cloud', '*@cloud', 'me@acme.com', 'SSOWorkingMode']) + formatOutput(['1375488836673@cloud', 'acme@unity', 'me@acme.com', 'SSOWorkingMode']);

    expect(parseAccounts(output)).toEqual([
      { name: '*@cloud', server: '*@cloud', user: 'me@acme.com', workingMode: 'SSOWorkingMode' },
      { name: '1375488836673@cloud', server: 'acme@unity', user: 'me@acme.com', workingMode: 'SSOWorkingMode' },
    ]);
  });
});
