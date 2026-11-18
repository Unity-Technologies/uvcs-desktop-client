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
  const sessionChecks = new SessionChecks({ check: (server) => checkConnection(cm, server), sessions, signedInAgain: () => cm.restartShells() });
  cm.gateSignIns(signInGate({ sessions, checks: sessionChecks, workspaceServers }));
  sessions.onChange(tell);
  return { sessions, sessionChecks };
}
