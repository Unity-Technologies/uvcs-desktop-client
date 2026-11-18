import { describe, expect, it } from 'vitest';
import { serverAccount, unityAccount } from '../../testing/userAccounts';
import { accountOfServer, unityAccountsOf } from './userAccounts';

const ana = unityAccount('ana@example.com', ['acme@unity', 'codice@cloud'], { wildcard: true });
const bo = unityAccount('bo@example.com', ['games@unity']);
const build = serverAccount('build:8087');

describe('unityAccountsOf', () => {
  it('keeps the Unity accounts, in their order', () => {
    expect(unityAccountsOf([ana, build, bo])).toEqual([ana, bo]);
  });
});

describe('accountOfServer', () => {
  it('finds the account listing the server, whatever its case', () => {
    expect(accountOfServer([ana, bo, build], 'Games@Unity')).toBe(bo);
    expect(accountOfServer([ana, bo, build], 'build:8087')).toBe(build);
  });

  it('takes a cloud organization no account lists for the one signing in to every organization (`*@cloud`)', () => {
    expect(accountOfServer([bo, ana], 'other@unity')).toBe(ana);
    expect(accountOfServer([bo], 'other@unity')).toBeUndefined();
  });

  it('finds none for a server no account lists, nor for this computer', () => {
    expect(accountOfServer([ana, build], 'art:8087')).toBeUndefined();
    expect(accountOfServer([ana, build], 'local')).toBeUndefined();
  });
});
