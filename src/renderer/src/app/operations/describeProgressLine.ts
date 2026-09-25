const ITEM_OPERATIONS: Record<string, string> = {
  U: 'Updating',
  C: 'Creating',
  D: 'Deleting',
  M: 'Moving',
};

/** Turns raw `cm` progress output into a short human-readable line, or null to skip it. */
export function describeProgressLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const stage = /^<STAGE:(.*)>$/.exec(trimmed) ?? /^STAGE (.+)$/.exec(trimmed);
  if (stage) return stage[1]!.trim() || null;

  const item = /^<([A-Z]):(.*)>$/.exec(trimmed);
  if (item) return `${ITEM_OPERATIONS[item[1]!] ?? 'Processing'} ${fileName(item[2]!)}`;

  if (/^(CI_START|CHANGESET )/.test(trimmed)) return null;
  return trimmed;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
