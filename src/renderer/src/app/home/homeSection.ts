/** What the home screen shows: workspaces, or the repositories of one server. */
export type HomeSection = { kind: 'recent' } | { kind: 'all' } | { kind: 'server'; server: string };

export function isSameSection(a: HomeSection, b: HomeSection): boolean {
  return a.kind === b.kind && (a.kind !== 'server' || (b.kind === 'server' && a.server === b.server));
}
