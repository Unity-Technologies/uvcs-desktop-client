import { describe, expect, it } from 'vitest';
import { classifySetupCheck, signInServer } from './setupCheck';

// Outputs of `cm checkconnection` (cm 11.0.16) with a fresh home folder, an unreachable server and a cloud server without a sign-in.
const NOT_CONFIGURED =
  "Error: Unity VCS client is not correctly configured for the current user: Client config file /Users/me/.plastic4/client.conf not found. Please execute 'cm configure' to perform a text mode configuration or 'macplastic --configure' for graphical mode.";
const SIGN_IN_PROMPT = 'Getting organization providers...\nSelect the system you want to use to sign in to: codice@cloud\n0 - Okta Unity\n1 - Unity ID';

describe('classifySetupCheck', () => {
  it('spots a client that was never configured', () => {
    expect(classifySetupCheck(NOT_CONFIGURED)).toBe('notConfigured');
  });

  it('spots the sign-in prompt of a server without credentials', () => {
    expect(classifySetupCheck(SIGN_IN_PROMPT)).toBe('notSignedIn');
    expect(classifySetupCheck('User: ')).toBe('notSignedIn');
  });

  it('takes anything else as a connection problem', () => {
    expect(classifySetupCheck('Error: Connection refused')).toBe('serverUnreachable');
    expect(classifySetupCheck("Error: Can't resolve DNS entry for nonexistent.example")).toBe('serverUnreachable');
    expect(classifySetupCheck('')).toBe('serverUnreachable');
  });
});

describe('signInServer', () => {
  it('reads the server named by the sign-in prompt', () => {
    expect(signInServer(SIGN_IN_PROMPT)).toBe('codice@cloud');
    expect(signInServer('Error: Connection refused')).toBeUndefined();
  });
});
