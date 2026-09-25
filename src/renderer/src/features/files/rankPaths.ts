/**
 * Ranks paths for a "go to file" search. Every query character must appear in order (fuzzy);
 * matches in the file name, at word starts and in a row score higher. Shorter paths break ties.
 */
export function rankPaths(paths: readonly string[], query: string, limit: number): string[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, '');
  if (!needle) return paths.slice(0, limit);

  return paths
    .map((path) => ({ path, score: scorePath(path, needle) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
    .slice(0, limit)
    .map((candidate) => candidate.path);
}

function scorePath(path: string, needle: string): number {
  const haystack = path.toLowerCase();
  const nameStart = haystack.lastIndexOf('/') + 1;
  let score = 1;
  let position = -1;

  for (const char of needle) {
    const found = haystack.indexOf(char, position + 1);
    if (found === -1) return 0;

    if (found === position + 1) score += 3;
    if (found >= nameStart) score += 2;
    if (found === 0 || '/._-'.includes(haystack[found - 1]!)) score += 2;
    position = found;
  }
  return score;
}
