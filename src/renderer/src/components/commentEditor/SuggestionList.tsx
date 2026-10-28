import { Search } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { Spinner } from '../../ui/Spinner';
import { CHIP_ICONS } from '../comments/chipIcons';
import { suggestionListPosition, type Box } from './popupPosition';
import type { Suggestion } from './suggestionItems';
import type { SuggestionRow } from './suggestionRows';
import styles from './SuggestionList.module.css';

interface SuggestionListProps {
  id: string;
  rows: readonly SuggestionRow[];
  active: number;
  /** Where the trigger typed is (`cs:`, `@`), which the list opens under. */
  anchor: Box;
  /** What was typed after the trigger: marked in each row as the lists' filter marks it (`Highlight`). */
  query: string;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}

/**
 * The suggestions for what is being typed, under it: a listbox the field's `aria-activedescendant` walks, its rows
 * picked with the keys or the pointer while the caret stays in the field.
 */
export function SuggestionList({ id, rows, active, anchor, query, onPick, onHover }: SuggestionListProps) {
  const list = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  // Placed again whenever the trigger moves or the list's size does: rows of the same count may be taller or wider
  // ("Reading branches…" giving way to a branch), which would leave a list opened under the line past the window.
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const place = (): void =>
      setPosition(suggestionListPosition(anchor, { width: element.offsetWidth, height: element.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
    place();
    const resized = new ResizeObserver(place);
    resized.observe(element);
    return () => resized.disconnect();
  }, [anchor.left, anchor.top, anchor.bottom]);
  useLayoutEffect(() => {
    list.current?.querySelector(`#${CSS.escape(optionId(id, active))}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, active]);

  const style: CSSProperties = position ? { left: position.left, top: position.top } : { left: anchor.left, top: anchor.bottom, visibility: 'hidden' };
  return createPortal(
    <div ref={list} id={id} className={styles.list} role="listbox" aria-label="Suggestions" style={style} onMouseDown={(event) => event.preventDefault()}>
      <HighlightQuery query={query}>
      {rows.map((row, index) =>
        row.kind === 'note' ? (
          <div key={`note:${row.text}`} className={styles.note} role="presentation">
            {row.pending && <Spinner size={12} />}
            {row.text}
          </div>
        ) : (
          <div
            key={row.kind === 'pick' ? row.suggestion.key : 'searchAll'}
            id={optionId(id, index)}
            className={styles.option}
            role="option"
            aria-selected={index === active}
            onMouseMove={() => index !== active && onHover(index)}
            onClick={() => onPick(index)}
          >
            {row.kind === 'pick' ? <SuggestionRowContent suggestion={row.suggestion} /> : <SearchAllRow text={row.text} />}
          </div>
        ),
      )}
      </HighlightQuery>
    </div>,
    document.body,
  );
}

export function optionId(listId: string, index: number): string {
  return `${listId}-option-${index}`;
}

function SuggestionRowContent({ suggestion }: { suggestion: Suggestion }) {
  return (
    <>
      <span className={styles.lead}>
        <SuggestionIcon suggestion={suggestion} />
      </span>
      <span className={styles.label}>
        <Highlight text={suggestion.label} />
      </span>
      {suggestion.detail && (
        <span className={styles.detail}>
          <Highlight text={suggestion.detail} />
        </span>
      )}
      {suggestion.owner && (
        <span className={styles.owner}>
          <Highlight text={displayName(suggestion.owner)} />
        </span>
      )}
    </>
  );
}

function SuggestionIcon({ suggestion }: { suggestion: Suggestion }) {
  if (suggestion.glyph) return <span className={styles.emoji}>{suggestion.glyph}</span>;
  if (suggestion.person) return <Avatar user={suggestion.person} size={18} tip={null} />;
  if (suggestion.kind === 'emoji' || suggestion.kind === 'person') return null;
  const Icon = CHIP_ICONS[suggestion.kind];
  return <Icon className={styles.icon} size={14} strokeWidth={2.25} aria-hidden />;
}

function SearchAllRow({ text }: { text: string }) {
  return (
    <>
      <span className={styles.lead}>
        <Search className={styles.icon} size={14} strokeWidth={2.25} aria-hidden />
      </span>
      <span className={styles.searchAll}>Search all changesets for “{text}”</span>
      {/* As the palette's same row says it. */}
      <span className={styles.detail}>May take a few seconds</span>
    </>
  );
}
