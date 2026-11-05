import type { IssueTrackersApi } from '@shared/api/issueTrackers';
import type { ServiceContext } from './ServiceContext';

/** Issue trackers (docs/features/issue-trackers.md): the engine in main (`IssueTrackers`), over the window's API. */
export function createIssueTrackersService({ issueTrackers }: ServiceContext): IssueTrackersApi {
  return {
    setup: async () => issueTrackers.setup(),
    signInWithToken: (request) => issueTrackers.signInWithToken(request),
    signInAgain: (request) => issueTrackers.signInAgain(request),
    retrySignIn: (connectionId) => issueTrackers.retrySignIn(connectionId),
    openTokenPage: async (target) => issueTrackers.openTokenPage(target),
    clipboardHoldsToken: (target) => issueTrackers.clipboardHoldsToken(target),
    startDeviceSignIn: (request) => issueTrackers.startDeviceSignIn(request),
    finishDeviceSignIn: (flowId) => issueTrackers.finishDeviceSignIn(flowId),
    cancelDeviceSignIn: async (flowId) => issueTrackers.cancelDeviceSignIn(flowId),
    useConnection: (request) => issueTrackers.useConnection(request),
    addProject: (request) => issueTrackers.addProject(request),
    disconnect: async (repository) => issueTrackers.disconnect(repository),
    signOut: async (connectionId) => issueTrackers.signOut(connectionId),
    readIssues: (connectionId, keys) => issueTrackers.readIssues(connectionId, keys),
  };
}
