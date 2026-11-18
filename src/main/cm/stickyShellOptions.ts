/**
 * `cm`'s global options that a `cm shell` keeps for every later command of its session: who it signs in as, with what,
 * and the files it reads that from. A pooled shell runs every read of its folder, so one command carrying one would
 * change what all the others sign in as (docs/features/accounts.md "Options that stick to a shell"). Quick commands
 * never carry them (`refuseStickyShellOptions`); a process of its own (`execute`) may, as they end with it.
 */
export const STICKY_SHELL_OPTIONS = [
  '--server',
  '--username',
  '--password',
  '--token',
  '--workingmode',
  '--clientconf',
  '--tokensconf',
  '--cloudregionsconf',
  '--unityorgsconf',
  '--cacheserver',
  '--cachesrv',
  '-wks',
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
