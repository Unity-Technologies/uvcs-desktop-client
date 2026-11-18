import type { ServerSession } from '@shared/domain/signIn';
import { ServerSessions } from '../accounts/ServerSessions';
import { SessionChecks } from '../accounts/SessionChecks';
import { signInGate } from '../accounts/signInGate';
import type { CmClient } from '../cm/CmClient';
import { checkConnection } from '../cm/connectionCheck';
import type { WorkspaceServers } from '../workspace/WorkspaceServers';
import type { SignInContext } from '../services/ServiceContext';

/**
 * One sign-in state per server for the whole app (docs/features/accounts.md): every command goes by it from now on
 * (`CmClient.gateSignIns`), checks keep it (`SessionChecks`), and every window hears each change (`tell`).
 */
export function trackSignIns(cm: CmClient, workspaceServers: WorkspaceServers, tell: (sessions: ServerSession[]) => void): SignInContext {
  const sessions = new ServerSessions();
  // A server's shells: its workspaces', and those of folders no workspace's server is known for (the folder a repository
  // explored without one runs in, the home folder), which may hold its sign-in too.
  const restartShells = (server: string): void => cm.restartShells((cwd) => (workspaceServers.serverOf(cwd) ?? server) === server);
  const sessionChecks = new SessionChecks({ check: (server) => checkConnection(cm, server), sessions, restartShells });
  cm.gateSignIns(signInGate({ sessions, checks: sessionChecks, workspaceServers }));
  sessions.onChange(tell);
  return { sessions, sessionChecks };
}
