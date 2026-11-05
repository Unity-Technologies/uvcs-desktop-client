/**
 * The repositories where something kept per repository is turned off: kept as it is, applied nowhere until turned
 * back on. Only the ones off are named, so a repository starts with it on.
 */
export type OffByRepository = Readonly<Record<string, true>>;

export function withOnIn(off: OffByRepository, repository: string, on: boolean): OffByRepository {
  if (!on) return { ...off, [repository]: true };
  const { [repository]: _off, ...rest } = off;
  return rest;
}

/** Whether it's on in `repository`; on while no repository is known yet. */
export function isOnIn(off: OffByRepository, repository: string | undefined): boolean {
  return repository === undefined || off[repository] !== true;
}
