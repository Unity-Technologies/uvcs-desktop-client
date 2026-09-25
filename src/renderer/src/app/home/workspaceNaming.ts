/** A workspace name for a repository: `codice/unitymerge` → `unitymerge`, made unique among `takenNames`. */
export function suggestWorkspaceName(repositoryName: string, takenNames: readonly string[]): string {
  const base = (repositoryName.split('/').at(-1) ?? repositoryName).trim() || 'workspace';
  const taken = new Set(takenNames.map((name) => name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`.toLowerCase())) suffix++;
  return `${base}-${suffix}`;
}
