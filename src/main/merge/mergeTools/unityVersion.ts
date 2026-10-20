/**
 * A Unity Editor version as Unity Hub names its folders: `6000.3.19f1`, `2022.3.62f3`, `6000.5.0a5`. The letter is the
 * kind of release.
 */
const UNITY_VERSION = /^(\d+)\.(\d+)\.(\d+)([a-z])(\d+)/;

/** The kinds of release, older first for the same number: alpha, beta, final (`c`: a China final), patch on a final. */
const KIND_ORDER: Record<string, number> = { a: 0, b: 1, f: 2, c: 2, p: 3 };
const FIRST_RELEASE_KIND = KIND_ORDER.f!;

/** What orders versions, as numbers: releases before the rest, then the version's numbers and kind. */
function sortKey(version: string): number[] | null {
  const match = UNITY_VERSION.exec(version);
  if (!match) return null;
  const kind = KIND_ORDER[match[4]!] ?? -1;
  return [kind >= FIRST_RELEASE_KIND ? 1 : 0, Number(match[1]), Number(match[2]), Number(match[3]), kind, Number(match[5])];
}

/**
 * Orders versions the way Smart Merge is picked: the newest release first, then alphas and betas (an alpha's tools are
 * the least tried), then names that aren't versions at all (a folder renamed by hand), by name.
 */
export function compareUnityVersions(a: string, b: string): number {
  const [keyA, keyB] = [sortKey(a), sortKey(b)];
  if (!keyA || !keyB) return keyA ? -1 : keyB ? 1 : a.localeCompare(b);
  const differing = keyA.findIndex((part, index) => part !== keyB[index]);
  return differing === -1 ? 0 : keyB[differing]! - keyA[differing]!;
}
