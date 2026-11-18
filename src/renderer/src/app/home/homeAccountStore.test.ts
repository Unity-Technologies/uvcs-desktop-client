import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { serverAccount, unityAccount } from '../../testing/userAccounts';
import { queryClient } from '../queryClient';
import { showHomeAccount, useHomeAccountPick } from './homeAccountStore';
import { WELCOME } from './homeSection';
import { useHomeSection } from './homeSectionStore';

const ana = unityAccount('ana@example.com', ['acme@unity']);
const bo = unityAccount('bo@example.com', ['games@unity']);
const accounts = [ana, bo, serverAccount('build:8087')];

afterEach(() => {
  useHomeAccountPick.getState().forget();
  useHomeSection.getState().show(WELCOME);
  queryClient.clear();
});

describe('showHomeAccount', () => {
  it("shows the account in this window and remembers it for the next home screen, asking `cm` nothing", () => {
    fakeApi.answer('settings.update', () => ({ ...DEFAULT_SETTINGS, homeAccount: bo.id }));

    showHomeAccount(bo, accounts);

    expect(useHomeAccountPick.getState().picked).toBe(bo.id);
    expect(fakeApi.calls()).toEqual([{ method: 'settings.update', args: [{ homeAccount: bo.id }] }]);
  });

  it("leaves the repositories of the account left for the welcome, and keeps a server's", () => {
    fakeApi.answer('settings.update', () => DEFAULT_SETTINGS);

    useHomeSection.getState().show({ kind: 'server', server: 'acme@unity' });
    showHomeAccount(bo, accounts);
    expect(useHomeSection.getState().section).toEqual(WELCOME);

    useHomeSection.getState().show({ kind: 'server', server: 'build:8087' });
    showHomeAccount(ana, accounts);
    expect(useHomeSection.getState().section).toEqual({ kind: 'server', server: 'build:8087' });
  });
});
