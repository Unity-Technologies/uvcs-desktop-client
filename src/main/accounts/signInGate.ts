import type { SignInGate } from '../cm/CmClient';
import type { WorkspaceServers } from '../workspace/WorkspaceServers';
import type { ServerSessions } from './ServerSessions';
import type { SessionChecks } from './SessionChecks';

/**
 * The sign-in gate `CmClient` runs every command by (docs/features/accounts.md "The gate"): a command's server is the one
 * it names or its workspace's, never guessed; a server that needs a sign-in gets no server command; and a sign-in
 * failure counts only once a check of the server confirms it. The check itself always passes.
 */
export function signInGate({ sessions, checks, workspaceServers }: { sessions: ServerSessions; checks: SessionChecks; workspaceServers: WorkspaceServers }): SignInGate {
  return {
    serverOf: (cwd, named) => named ?? workspaceServers.serverOf(cwd),
    learnServerOf: (cwd) => workspaceServers.learn(cwd),
    passes: (args) => args[0] === 'checkconnection',
    refusal: (server) => {
      const session = sessions.of(server);
      return session.state === 'needsSignIn' ? session.problem : undefined;
    },
    confirm: (server, commandStartedAt) => checks.confirm(server, commandStartedAt),
  };
}
