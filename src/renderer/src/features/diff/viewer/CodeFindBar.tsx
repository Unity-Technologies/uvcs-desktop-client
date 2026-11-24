import { ArrowDown, ArrowUp, ChevronRight, Replace, ReplaceAll, Search, X } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { hotkey } from '../../../lib/shortcutRegistry';
import { IconButton } from '../../../ui/IconButton';
import { Tooltip } from '../../../ui/Tooltip';
import { findBarKeyAction, type FindBarField, type FindOptions } from './codeFind';
import type { CodeFindBarModel } from './useCodeFind';
import styles from './CodeFindBar.module.css';

/** The search's options, each drawn as the letters it stands for, as code editors draw them. */
const TOGGLES: { option: keyof FindOptions; label: string; glyph: ReactNode }[] = [
  { option: 'matchCase', label: 'Match case', glyph: 'Aa' },
  { option: 'wholeWord', label: 'Match whole words', glyph: <span className={styles.underlined}>ab</span> },
  { option: 'regex', label: 'Use regular expression', glyph: '.*' },
];

/**
 * The search over a diff (`useCodeFind`), at the top right of the side it searches: the text searched for with its
 * options, the count and the arrows, and, over the text typed into, the replace field the chevron shows. Its keys are
 * `findBarKeyAction`'s.
 */
export function CodeFindBar({ bar }: { bar: CodeFindBarModel }) {
  const { options, setOptions } = bar;

  const keysOf =
    (field: FindBarField) =>
    (event: KeyboardEvent): void => {
      const action = findBarKeyAction(event.nativeEvent, field);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'close') bar.close();
      else if (action === 'reselect') bar.inputRef.current?.select();
      else if (action === 'showReplace') bar.showReplace();
      else if (action === 'replaceOne') bar.replace();
      else bar.step(action === 'previous');
    };

  // In the order Tab goes: the text searched for, its replacement, then the buttons; the grid lays them out in rows.
  return (
    <div className={styles.bar} role="search" data-replaceable={bar.toggleReplace ? '' : undefined} data-replacing={bar.replacing ? '' : undefined} style={bar.right === null ? undefined : { right: bar.right }}>
      <Search size={13} className={styles.fieldIcon} />
      <input
        ref={bar.inputRef}
        className={`${styles.input} ${styles.searchInput}`}
        value={bar.query}
        onChange={(event) => bar.setQuery(event.target.value)}
        onKeyDown={keysOf('search')}
        placeholder="Search"
        aria-label="Search"
        spellCheck={false}
      />
      {bar.replacing && (
        <input
          className={`${styles.input} ${styles.replaceInput}`}
          value={bar.replacement}
          onChange={(event) => bar.setReplacement(event.target.value)}
          onKeyDown={keysOf('replace')}
          placeholder="Replace"
          aria-label="Replace with"
          spellCheck={false}
        />
      )}
      <div className={styles.toggles}>
        {TOGGLES.map(({ option, label, glyph }) => (
          <Tooltip key={option} content={label}>
            <button type="button" className={styles.toggle} aria-label={label} aria-pressed={options[option]} onClick={() => setOptions({ ...options, [option]: !options[option] })}>
              {glyph}
            </button>
          </Tooltip>
        ))}
      </div>
      <span className={styles.count} data-none={!bar.hasMatches || undefined} aria-live="polite">
        {bar.countWords}
      </span>
      <div className={styles.nav}>
        <IconButton className={styles.icon} icon={<ArrowUp size={14} />} label="Previous match" shortcut={hotkey('textFindPrevious')} size="small" disabled={!bar.hasMatches} onClick={() => bar.step(true)} />
        <IconButton className={styles.icon} icon={<ArrowDown size={14} />} label="Next match" shortcut={hotkey('textFindNext')} size="small" disabled={!bar.hasMatches} onClick={() => bar.step(false)} />
      </div>
      {bar.replacing && (
        <div className={styles.replaceActions}>
          <IconButton className={styles.icon} icon={<Replace size={14} />} label="Replace" shortcut={hotkey('textFindNext')} size="small" disabled={!bar.hasMatches} onClick={bar.replace} />
          <IconButton className={styles.icon} icon={<ReplaceAll size={14} />} label="Replace all" size="small" disabled={!bar.hasMatches} onClick={bar.replaceAll} />
        </div>
      )}
      {bar.toggleReplace && (
        <Tooltip content={bar.replacing ? 'Hide replace' : 'Replace'} shortcut={hotkey('textReplace')}>
          <button type="button" className={styles.replaceToggle} aria-label="Replace" aria-expanded={bar.replacing} onClick={bar.toggleReplace}>
            <ChevronRight size={14} />
          </button>
        </Tooltip>
      )}
      <Tooltip content="Close" shortcut={hotkey('textCloseFind')}>
        <button type="button" className={styles.close} aria-label="Close" onClick={bar.close}>
          <X size={11} strokeWidth={2.5} />
        </button>
      </Tooltip>
    </div>
  );
}
