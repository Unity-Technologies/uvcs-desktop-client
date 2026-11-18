/**
 * `cm`'s global options that a `cm shell` keeps for every later command of its session: who it signs in as, with what,
 * the files it reads that from, encryption settings, and the folder it works in. A pooled shell runs every read of its folder, so one command carrying one would
 * change what all the others sign in as (docs/features/accounts.md "Options that stick to a shell"). Quick commands
 * never carry them (`refuseStickyShellOptions`); a process of its own (`execute`) may, as they end with it.
 */
export const STICKY_SHELL_OPTIONS = [
  // Who it signs in as, and with what.
  '--server',
  '--username',
  '--password',
  '--token',
  '--workingmode',
  // The files it reads its sign-in and organizations from; `cm` reads the older single-dash forms first.
  '--clientconf',
  '-clientconf',
  '--tokensconf',
  '--cloudregionsconf',
  '--unityorgsconf',
  '--cacheserver',
  '-cacheserver',
  // Encryption settings, kept in memory for the rest of the session.
  '--encryptmethod',
  '--encryptpassword',
  '--encryptserver',
  // The workspace and the folder it works in, for every later command.
  '-wks',
  '-path',
] as const;

/** The sticky option an argument is (`--username`, `--username=ana`), or undefined; `cm` reads options in any case. */
function stickyOptionOf(arg: string): string | undefined {
  const name = arg.split('=', 1)[0]!.toLowerCase();
  return STICKY_SHELL_OPTIONS.find((option) => option === name);
}

/**
 * Throws for a quick command (`CmClient.query` and the reads like it, which a pooled `cm shell` runs) carrying an
 * option a shell keeps for its whole session: a developer's mistake, never a state of the user's.
 */
export function refuseStickyShellOptions(args: readonly string[]): void {
  const sticky = args.map(stickyOptionOf).find((option) => option !== undefined);
  if (sticky) throw new Error(`${sticky} sticks to a pooled cm shell for every later command: run this command with execute(), in a process of its own.`);
}
