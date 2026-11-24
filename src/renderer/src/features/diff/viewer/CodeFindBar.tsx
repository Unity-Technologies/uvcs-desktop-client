import { ArrowDown, ArrowUp, CaseSensitive, Regex, WholeWord, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { hotkey } from '../../../lib/shortcutRegistry';
import { IconButton } from '../../../ui/IconButton';
import { findBarKeyAction, type FindOptions } from './codeFind';
import type { CodeFindBarModel } from './useCodeFind';
import styles from './CodeFindBar.module.css';

/** The bar's toggles, in Pierre's search panel's order. */
const TOGGLES: { option: keyof FindOptions; label: string; icon: typeof CaseSensitive }[] = [
  { option: 'matchCase', label: 'Match case', icon: CaseSensitive },
  { option: 'wholeWord', label: 'Match whole words', icon: WholeWord },
  { option: 'regex', label: 'Use regular expression', icon: Regex },
];

/**
 * The search box over a diff's read-only side (`useCodeFind`), at the top right of that side: drawn as Pierre's search
 * panel is over the side typed into (one row: the field with its toggles inside, the count, the arrows; the close
 * button on its corner), so both sides' searches look alike. Its keys are `findBarKeyAction`'s.
 */
export function CodeFindBar({ bar }: { bar: CodeFindBarModel }) {
  const { options, setOptions } = bar;

  const onKeyDownCapture = (event: KeyboardEvent): void => {
    const action = findBarKeyAction(event.nativeEvent);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (action === 'close') bar.close();
    else if (action === 'reselect') bar.inputRef.current?.select();
    else bar.step(action === 'previous');
  };

  return (
    <div className={styles.bar} role="search" style={bar.right === null ? undefined : { right: bar.right }} onKeyDownCapture={onKeyDownCapture}>
      <div className={styles.field}>
        <input ref={bar.inputRef} className={styles.input} value={bar.query} onChange={(event) => bar.setQuery(event.target.value)} placeholder="Search" aria-label="Search" spellCheck={false} />
        <div className={styles.toggles}>
          {TOGGLES.map(({ option, label, icon: Icon }) => (
            <IconButton
              key={option}
              className={styles.icon}
              icon={<Icon size={14} />}
              label={label}
              size="small"
              aria-pressed={options[option]}
              onClick={() => setOptions({ ...options, [option]: !options[option] })}
            />
          ))}
        </div>
      </div>
      <span className={styles.count} data-none={!bar.hasMatches || undefined} aria-live="polite">
        {bar.countWords}
      </span>
      <IconButton className={styles.icon} icon={<ArrowUp size={14} />} label="Previous match" shortcut={hotkey('textFindPrevious')} size="small" disabled={!bar.hasMatches} onClick={() => bar.step(true)} />
      <IconButton className={styles.icon} icon={<ArrowDown size={14} />} label="Next match" shortcut={hotkey('textFindNext')} size="small" disabled={!bar.hasMatches} onClick={() => bar.step(false)} />
      <IconButton className={styles.close} icon={<X size={12} />} label="Close" shortcut={hotkey('textCloseFind')} size="small" onClick={bar.close} />
    </div>
  );
}
