import { commentLineText } from '../../lib/comments/commentText';
import { markdownPreview } from '../../lib/markdown';

/** How an attribute value reads best: a status pill, a link, a long text folded to one line, or plain text. */
export type AttributeValueKind = 'empty' | 'pill' | 'url' | 'long' | 'text';

export type AttributeTone = 'success' | 'danger' | 'warning' | 'neutral';

const MAX_PILL_LENGTH = 24;
const MAX_PILL_WORDS = 2;
const MAX_SHORT_LENGTH = 90;
const MAX_SUGGESTION_LENGTH = 40;
const MAX_SUGGESTIONS = 12;

const TONE_WORDS: Record<Exclude<AttributeTone, 'neutral'>, string[]> = {
  success: ['resolved', 'ready', 'done', 'passed', 'pass', 'ok', 'success', 'succeeded', 'enabled', 'true', 'yes', 'approved', 'merged', 'reviewed', 'completed', 'green', 'stable', 'released'],
  danger: ['failed', 'fail', 'failure', 'error', 'broken', 'rejected', 'blocked', 'red', 'false', 'no', 'disabled', 'cancelled', 'canceled'],
  warning: ['pending', 'in progress', 'running', 'wip', 'rework', 'rework required', 'waiting', 'queued', 'open', 'testing', 'under review', 'draft', 'yellow'],
};

export function attributeValueKind(value: string): AttributeValueKind {
  const trimmed = value.trim();
  if (!trimmed) return 'empty';
  if (/^https?:\/\/\S+$/i.test(trimmed)) return 'url';
  if (trimmed.includes('\n') || trimmed.length > MAX_SHORT_LENGTH) return 'long';
  if (trimmed.length <= MAX_PILL_LENGTH && trimmed.split(/\s+/).length <= MAX_PILL_WORDS) return 'pill';
  return 'text';
}

/**
 * What a value's chip says: "empty", a long text folded to one line, a link without its scheme, else the value as it
 * reads, its Markdown marks left out (`**urgent**` says "urgent").
 */
export function chipText(value: string): string {
  const trimmed = value.trim();
  switch (attributeValueKind(value)) {
    case 'empty':
      return 'empty';
    case 'long':
      return markdownPreview(trimmed);
    case 'url':
      return trimmed.replace(/^https?:\/\//i, '');
    default:
      return commentLineText(trimmed);
  }
}

/** What hovering a value's chip shows: a tooltip of text, a card with a long text's Markdown drawn, or nothing. */
export type ChipHover = { kind: 'tip'; text: string } | { kind: 'card'; markdown: string } | { kind: 'none' };

/**
 * A link shows its whole address; a short value reads as it does on the chip (`chipText`), after its attribute's name.
 * A long text (release notes: Markdown, most often) shows whole in a card, drawn as it reads, as a comment's chips show
 * theirs (`ChipHoverCard`); while it's open under the chips, the card would only repeat it.
 */
export function chipHover(attribute: { name: string; value: string }, opened: boolean): ChipHover {
  switch (attributeValueKind(attribute.value)) {
    case 'url':
      return { kind: 'tip', text: attribute.value.trim() };
    case 'long':
      return opened ? { kind: 'none' } : { kind: 'card', markdown: attribute.value.trim() };
    default:
      return { kind: 'tip', text: `${attribute.name}: ${chipText(attribute.value)}` };
  }
}

/** Where a value is edited: a quick field offering the values it takes elsewhere, or the comment editor for a text. */
export type AttributeEditor = 'value' | 'text';

/**
 * A long text (release notes, a description: Markdown, most often) opens in the comment editor, its Markdown drawn as
 * it reads; anything shorter in the quick field, where Enter saves. A draft there that gains a second line (⇧↵, a
 * paste) moves on to the comment editor too.
 */
export function attributeEditorFor(value: string): AttributeEditor {
  return attributeValueKind(value) === 'long' ? 'text' : 'value';
}

/** Whether the quick field's draft has become a text of many lines, which the comment editor takes from there. */
export function outgrowsQuickField(draft: string): boolean {
  return draft.includes('\n');
}

/** Green for values that mean "good", red for "bad", amber for "in between"; anything else stays neutral. */
export function attributeTone(value: string): AttributeTone {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  for (const [tone, words] of Object.entries(TONE_WORDS) as [Exclude<AttributeTone, 'neutral'>, string[]][]) {
    if (words.includes(normalized)) return tone;
  }
  return 'neutral';
}

/**
 * The values an attribute's comment offers, following the Plastic convention of a `default:` line,
 * e.g. `default: open, resolved, "won't fix"`.
 */
export function defaultValuesIn(comment: string): string[] {
  const line = comment.split('\n').find((candidate) => /^\s*default\s*:/i.test(candidate));
  if (!line) return [];
  const list = line.slice(line.indexOf(':') + 1);
  return [...list.matchAll(/\s*(?:"([^"]*)"|([^,]+))/g)].map((match) => (match[1] ?? match[2] ?? '').trim()).filter(Boolean);
}

/** The short values an attribute takes, each once with how many times, most used first; long texts are left out. */
export function valueCounts(used: string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of used) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('\n') || trimmed.length > MAX_SUGGESTION_LENGTH) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }));
}

/** What to offer while editing: the declared defaults first, then the short values most used elsewhere. */
export function suggestedValues(defaults: string[], used: string[]): string[] {
  return [...new Set([...defaults, ...valueCounts(used).map(({ value }) => value)])].slice(0, MAX_SUGGESTIONS);
}
