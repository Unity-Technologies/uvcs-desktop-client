import type { Action } from '../lib/actions';
import { copyToClipboard } from '../lib/copyToClipboard';
import { formatCount } from '../lib/text';
import type { GroupedEntry } from '../lib/menuGroups';
import { menuSubmenu } from './menuWords';

/**
 * What an object can be copied as, in the order every "Copy" submenu lists them: what people paste most first (its
 * name, number, title or path), then its specs (`br:/main/task`, `cs:42`, `lb:v1`, `sh:3`; the full one adds
 * `@repository`), then its comment and GUID. The first one an object has is what ⌘C copies in its list.
 */
export const COPY_KINDS = ['name', 'number', 'title', 'path', 'fullPath', 'serverPath', 'spec', 'fullSpec', 'comment', 'guid'] as const;

export type CopyKind = (typeof COPY_KINDS)[number];

/** A text to copy, or a way to read it when it is copied (a GUID the view didn't read). */
export type CopyText = string | (() => Promise<string | undefined>);

export type CopyTexts = Partial<Record<CopyKind, CopyText | false | null | undefined>>;

const LABELS: Record<CopyKind, string> = {
  name: 'Name',
  title: 'Title',
  number: 'Number',
  path: 'Path',
  fullPath: 'Full path',
  serverPath: 'Repository path',
  spec: 'Spec',
  fullSpec: 'Full spec',
  comment: 'Comment',
  guid: 'GUID',
};

/** Kinds whose text is prose, too long to show beside the label. */
const PROSE: ReadonlySet<CopyKind> = new Set(['title', 'comment']);

/** The ids of the entries of every "Copy" submenu, e.g. for the popups that stay open while copying. */
export const COPY_ENTRY_IDS = COPY_KINDS.map((kind) => `copy.${kind}`);

/**
 * What the toast says was copied: "Branch spec", "Changeset GUID", "Path" for an item, "3 paths" for several.
 * `noun` is the object's kind as a sentence starts it ("Branch", "Code review"), empty for files.
 */
export function copiedWhat(noun: string, kind: CopyKind, count = 1): string {
  const label = kind === 'guid' ? LABELS[kind] : LABELS[kind].toLowerCase();
  if (count > 1) return `${formatCount(count)} ${kind === 'fullPath' ? 'full paths' : kind === 'serverPath' ? 'repository paths' : `${label}s`}`;
  return noun ? `${noun} ${label}` : LABELS[kind];
}

/**
 * An object's one "Copy" submenu, the same in every menu it shows in: the texts it has, in `COPY_KINDS` order, each
 * showing what it copies. `count` is how many objects the texts hold, one per line. `shortcut` goes on the first
 * entry, the one ⌘C copies where the list binds it.
 */
export function copySubmenu(noun: string, texts: CopyTexts, { count = 1, shortcut }: { count?: number; shortcut?: string } = {}): GroupedEntry | null {
  const entries: Action[] = copyEntries(noun, texts, count);
  if (entries.length === 0) return null;
  if (shortcut) entries[0] = { ...entries[0]!, shortcut };
  return menuSubmenu('copy', entries);
}

function copyEntries(noun: string, texts: CopyTexts, count: number): Action[] {
  return COPY_KINDS.flatMap((kind) => {
    // An empty text (no comment) isn't offered.
    const text = texts[kind];
    if (!text) return [];
    const detail = typeof text === 'string' && !PROSE.has(kind) && count === 1 ? text : undefined;
    return [{ id: `copy.${kind}`, label: LABELS[kind], detail, run: () => void copyText(text, copiedWhat(noun, kind, count)) }];
  });
}

/** Copies what the first entry of an object's "Copy" submenu copies: ⌘C in its list. */
export function copyDefault(noun: string, texts: CopyTexts): (() => void) | undefined {
  return copyEntries(noun, texts, 1)[0]?.run;
}

async function copyText(text: CopyText, what: string): Promise<void> {
  const value = typeof text === 'string' ? text : await text();
  if (value !== undefined) copyToClipboard(value, what);
}
