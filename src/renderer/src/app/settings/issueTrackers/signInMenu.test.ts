import { describe, expect, it } from 'vitest';
import { signInMenu } from './signInMenu';

describe('signInMenu', () => {
  it('offers signing out of a sign-in, asked first, as the danger it is', () => {
    const signOut = (): void => undefined;
    expect(signInMenu({ account: 'Ana Díaz', host: 'acme.atlassian.net' }, signOut)).toEqual({
      label: 'More for Ana Díaz at acme.atlassian.net',
      entries: [{ id: 'signOut', label: 'Sign out…', danger: true, run: signOut }],
    });
  });
});
