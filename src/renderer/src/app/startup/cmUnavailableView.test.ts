import { describe, expect, it } from 'vitest';
import { cmUnavailableView } from './cmUnavailableView';

describe('cmUnavailableView', () => {
  it('never asks to install anything when the app’s own cm doesn’t start', () => {
    expect(cmUnavailableView('managed')).toMatchObject({ title: 'Unity Version Control didn’t start', offersInstall: false });
  });

  it('offers to install it when the installed one is missing', () => {
    expect(cmUnavailableView('installed')).toMatchObject({ title: 'Unity Version Control is required', offersInstall: true });
    expect(cmUnavailableView('environment').offersInstall).toBe(true);
  });
});
