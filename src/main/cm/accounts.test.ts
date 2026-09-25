import { describe, expect, it } from 'vitest';
import { parseAccounts } from './accounts';

const record = (...fields: string[]): string => `${fields.join('\u001f')}\u001e\n`;

describe('parseAccounts', () => {
  it('keeps every profile, wildcard ones included, with the name that deletes it', () => {
    const output =
      record('*@cloud', '*@cloud', 'me@acme.com', 'SSOWorkingMode') + record('1375488836673@cloud', 'acme@unity', 'me@acme.com', 'SSOWorkingMode');

    expect(parseAccounts(output)).toEqual([
      { name: '*@cloud', server: '*@cloud', user: 'me@acme.com', workingMode: 'SSOWorkingMode' },
      { name: '1375488836673@cloud', server: 'acme@unity', user: 'me@acme.com', workingMode: 'SSOWorkingMode' },
    ]);
  });
});
