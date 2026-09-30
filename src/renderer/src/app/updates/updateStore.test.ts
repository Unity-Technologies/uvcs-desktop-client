import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import { useToastStore } from '../../ui/toast/toastStore';
import { checkForUpdates, loadUpdateStatus, putOffUpdate, setAboutOpen, useUpdateStore } from './updateStore';

const initial = useUpdateStore.getState();
const toasts = () => useToastStore.getState().toasts.map(({ kind, title, detail }) => ({ kind, title, detail }));

beforeEach(() => {
  useUpdateStore.setState(initial, true);
  useToastStore.setState({ toasts: [] });
  fakeApi.answer('updates.check', async () => undefined);
});

describe('a check this window asked for', () => {
  it('shows "Checking…" and turns that toast into the answer', () => {
    void checkForUpdates();
    fakeApi.emit('updateStatusChanged', { state: 'checking' });
    expect(toasts()).toEqual([{ kind: 'progress', title: 'Checking for updates…', detail: undefined }]);

    fakeApi.emit('updateStatusChanged', { state: 'upToDate' });
    expect(toasts()).toEqual([{ kind: 'success', title: "You're on the latest version.", detail: undefined }]);
  });

  it('says why it failed', () => {
    void checkForUpdates();
    fakeApi.emit('updateStatusChanged', { state: 'checking' });
    fakeApi.emit('updateStatusChanged', { state: 'failed', error: 'No published release is available to update from yet.' });

    expect(toasts()).toEqual([{ kind: 'error', title: "Couldn't check for updates", detail: 'No published release is available to update from yet.' }]);
  });

  it('leaves the update it found to the update card', () => {
    void checkForUpdates();
    fakeApi.emit('updateStatusChanged', { state: 'checking' });
    fakeApi.emit('updateStatusChanged', { state: 'downloading', version: '1.2.0', percent: 0 });

    expect(toasts()).toEqual([]);
    expect(useUpdateStore.getState().status).toEqual({ state: 'downloading', version: '1.2.0', percent: 0 });
  });

  it('says a development build never updates', () => {
    void checkForUpdates();
    fakeApi.emit('updateStatusChanged', { state: 'unavailable' });

    expect(toasts()).toEqual([{ kind: 'info', title: 'Development builds don’t update.', detail: undefined }]);
  });

  it('shows no toast while the About dialog shows the same', () => {
    setAboutOpen(true);
    void checkForUpdates();
    fakeApi.emit('updateStatusChanged', { state: 'checking' });
    fakeApi.emit('updateStatusChanged', { state: 'upToDate' });

    expect(toasts()).toEqual([]);
  });

  it('ends with its answer: the next check the app makes on its own says nothing', () => {
    void checkForUpdates();
    fakeApi.emit('updateStatusChanged', { state: 'upToDate' });
    useToastStore.setState({ toasts: [] });

    fakeApi.emit('updateStatusChanged', { state: 'checking' });
    fakeApi.emit('updateStatusChanged', { state: 'failed', error: 'offline' });

    expect(toasts()).toEqual([]);
  });

  it('fails in a toast when the main process can’t be asked', async () => {
    fakeApi.answer('updates.check', async () => {
      throw new Error('No handler');
    });

    await checkForUpdates();

    expect(toasts()).toEqual([{ kind: 'error', title: "Couldn't check for updates", detail: 'No handler' }]);
    expect(useUpdateStore.getState().askedCheck).toBeNull();
  });
});

describe('the checks the app makes on its own', () => {
  it('show no toast', () => {
    fakeApi.emit('updateStatusChanged', { state: 'checking' });
    fakeApi.emit('updateStatusChanged', { state: 'upToDate' });

    expect(toasts()).toEqual([]);
  });
});

describe('the status read as the window opens', () => {
  it('is where the update stands', async () => {
    fakeApi.answer('updates.status', async () => ({ state: 'ready', version: '1.2.0', install: 'restart' }));

    await loadUpdateStatus();

    expect(useUpdateStore.getState().status).toEqual({ state: 'ready', version: '1.2.0', install: 'restart' });
  });

  it('gives way to a newer status that arrived meanwhile', async () => {
    fakeApi.answer('updates.status', async () => ({ state: 'checking' }));

    const loading = loadUpdateStatus();
    fakeApi.emit('updateStatusChanged', { state: 'upToDate' });
    await loading;

    expect(useUpdateStore.getState().status).toEqual({ state: 'upToDate' });
  });
});

describe('putting an update off', () => {
  it('remembers the version ready now', () => {
    fakeApi.emit('updateStatusChanged', { state: 'ready', version: '1.2.0', install: 'installer' });

    putOffUpdate();

    expect(useUpdateStore.getState().dismissedVersion).toBe('1.2.0');
  });
});
