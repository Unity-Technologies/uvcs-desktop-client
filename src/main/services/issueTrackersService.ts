import type { IssueTrackersApi } from '@shared/api/issueTrackers';
import { currentCaller } from '../ipc/caller';
import type { ServiceContext } from './ServiceContext';

/** Issue trackers (docs/features/issue-trackers.md): the engine in main (`IssueTrackers`), over the window's API. */
export function createIssueTrackersService({ issueTrackers }: ServiceContext): IssueTrackersApi {
  return {
    setup: async () => issueTrackers.setup(),
    signInWithToken: (request) => issueTrackers.signInWithToken(request),
    signInAgain: (request) => issueTrackers.signInAgain(request),
    retrySignIn: (connectionId) => issueTrackers.retrySignIn(connectionId),
    openTokenPage: async (target) => issueTrackers.openTokenPage(target),
    startDeviceSignIn: async (request) => {
      // A window that closes stops the flow it started.
      const caller = currentCaller();
      const started = await issueTrackers.startDeviceSignIn(request, caller?.id);
      if (caller && 'flowId' in started) caller.once('destroyed', () => issueTrackers.windowClosed(caller.id));
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
