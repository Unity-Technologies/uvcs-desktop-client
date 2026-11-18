// A server whose session ended, as `cm` meets it (docs/features/accounts.md): `UVCS_FAKE_CM_SIGN_IN` names a file, read
// on every command, that holds the server's name, then optionally ` prompt`. While it does, every command to that server
// but the local ones fails: with `cm`'s sentence ("The auth token expired"), or, with ` prompt`, asking which system to
// sign in with, as `cm` does once it can't renew a sign-in. An empty or missing file: every server is signed in.
const { existsSync, readFileSync } = require('node:fs');

const SIGN_IN_FILE = process.env.UVCS_FAKE_CM_SIGN_IN;

/** Commands that only read this machine (`LOCAL_COMMANDS` in main/cm/repeatedCommands.ts): they never sign in. */
const LOCAL_COMMANDS = new Set(['status', 'getworkspacefrompath', 'gwp', 'wi', 'workspaceinfo', 'lwk', 'profile', 'version', 'location', 'changelist']);

const PROMPT = 'Select your system [0-1]: ';

/** The server that needs a sign-in now, and how `cm` meets it; null when none does. */
function signedOut() {
  if (!SIGN_IN_FILE || !existsSync(SIGN_IN_FILE)) return null;
  const [server, how] = readFileSync(SIGN_IN_FILE, 'utf8').trim().split(/\s+/);
  return server ? { server, prompts: how === 'prompt' } : null;
}

/** The server a command works with: the one `checkconnection` names, one an argument names, else the workspace's. */
function serverOf(args, workspaceServer, otherServers) {
  if (args[0] === 'checkconnection') return args[1];
  return otherServers.find((server) => args.some((arg) => arg.includes(server))) ?? workspaceServer;
}

function isLocal(args) {
  if (args[0] === 'workspace' || args[0] === 'wk') return args[1] === 'list';
  return LOCAL_COMMANDS.has(args[0]);
}

/**
 * How `cm <args>` fails for a sign-in, or null when it runs: `{ output, exitCode }` with the sentence, or `{ prompt }`
 * for a command that asks and waits (`cm.cjs` asks again and again in a process, and stalls in a `cm shell`).
 */
function signInFailure(args, { workspaceServer, otherServers }) {
  const ended = signedOut();
  if (!ended || isLocal(args) || serverOf(args, workspaceServer, otherServers) !== ended.server) return null;
  if (ended.prompts) return { prompt: PROMPT };
  return { output: 'Error: The auth token expired. User: tester@example.com.\n', exitCode: 1 };
}

module.exports = { signInFailure };
