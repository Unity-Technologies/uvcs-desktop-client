import type { WebContents } from 'electron';
import type { IssueTrackersApi } from '@shared/api/issueTrackers';
import { currentCaller } from '../ipc/caller';
import type { IssueTrackers } from '../issueTrackers/IssueTrackers';
import type { ServiceContext } from './ServiceContext';

/** Issue trackers (docs/features/issue-trackers.md): the engine in main (`IssueTrackers`), over the window's API. */
export function createIssueTrackersService({ issueTrackers }: ServiceContext): IssueTrackersApi {
  const endFlowsWithWindow = flowsEndWithTheirWindow(issueTrackers);
  return {
    setup: async () => issueTrackers.setup(),
    signInWithToken: (request) => issueTrackers.signInWithToken(request),
    signInAgain: (request) => issueTrackers.signInAgain(request),
    retrySignIn: (connectionId) => issueTrackers.retrySignIn(connectionId),
    openTokenPage: async (target) => issueTrackers.openTokenPage(target),
    startDeviceSignIn: async (request) => {
      const caller = currentCaller();
      const started = await issueTrackers.startDeviceSignIn(request, caller?.id);
      if (caller && 'flowId' in started) endFlowsWithWindow(caller);
      return started;
    },
    finishDeviceSignIn: (flowId) => issueTrackers.finishDeviceSignIn(flowId),
    cancelDeviceSignIn: async (flowId) => issueTrackers.cancelDeviceSignIn(flowId),
    useConnection: (request) => issueTrackers.useConnection(request),
    addProject: (request) => issueTrackers.addProject(request),
    disconnect: async (repository) => issueTrackers.disconnect(repository),
    signOut: async (connectionId) => issueTrackers.signOut(connectionId),
    readIssues: (connectionId, keys) => issueTrackers.readIssues(connectionId, keys),
  };
}

/**
 * The device flows a window started end with it: when it closes, and when its page reloads or leaves (a main frame's
 * navigation to another document), as nothing there waits for them any more. Each window is watched once; one gone
 * while its flow started ends it at once.
 */
function flowsEndWithTheirWindow(issueTrackers: Pick<IssueTrackers, 'windowClosed'>): (window: WebContents) => void {
  const watched = new WeakSet<WebContents>();
  return (window) => {
    const id = window.id;
    if (window.isDestroyed()) return issueTrackers.windowClosed(id);
    if (watched.has(window)) return;
    watched.add(window);
    window.once('destroyed', () => issueTrackers.windowClosed(id));
    window.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) issueTrackers.windowClosed(id);
    });
  };
}
