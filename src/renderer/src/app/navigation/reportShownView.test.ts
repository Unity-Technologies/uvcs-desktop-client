import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { navigation, useNavigation } from './navigationStore';
import { reportShownView } from './reportShownView';

afterEach(() => useNavigation.setState({ view: 'changes', pages: [] }));

describe('reportShownView', () => {
  it('tells the main process each view the window goes to, once each', () => {
    fakeApi.answer('windows.viewShown', () => undefined);
    const stop = reportShownView();

    navigation.goToView('branches');
    navigation.openPage({ kind: 'browseRepository', changesetId: 12 });
    navigation.goToView('branches');
    navigation.goToView('branchExplorer');
    stop();

    expect(fakeApi.argsOf('windows.viewShown')).toEqual([['branches'], ['branchExplorer']]);
  });
});
