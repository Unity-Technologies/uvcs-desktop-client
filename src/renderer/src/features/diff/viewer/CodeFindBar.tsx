import { ArrowDown, ArrowUp, CaseSensitive, WholeWord, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import { IconButton } from '../../../ui/IconButton';
import { SearchField } from '../../../ui/SearchField';
import type { CodeFindBarModel } from './useCodeFind';
import styles from './CodeFindBar.module.css';

/**
 * The search box over a diff's read-only side (`useCodeFind`): the text to find, whether case and whole words count,
 * which match shows of how many, the previous and next ones, and closing. Enter and Shift+Enter step through the
 * matches, Esc closes it, and ⌘F selects its text again rather than reaching the view's filter.
 */
export function CodeFindBar({ bar }: { bar: CodeFindBarModel }) {
  const { options, setOptions } = bar;

  const onKeyDownCapture = (event: KeyboardEvent): void => {
    const native = event.nativeEvent;
    const handled = (): void => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (matchesShortcut(native, hotkey('textCloseFind'))) {
      handled();
      bar.close();
    } else if (matchesShortcut(native, hotkey('textFindPrevious'))) {
      handled();
      bar.step(true);
    } else if (matchesShortcut(native, hotkey('textFindNext'))) {
      handled();
      bar.step(false);
    } else if (matchesShortcut(native, hotkey('textFind'))) {
      handled();
      bar.inputRef.current?.select();
    }
  };

  return (
    <div className={styles.bar} role="search" onKeyDownCapture={onKeyDownCapture}>
      <SearchField ref={bar.inputRef} value={bar.query} onChange={bar.setQuery} placeholder={bar.placeholder} aria-label={bar.placeholder} width={240} />
      <IconButton
        icon={<CaseSensitive size={14} />}
        label="Match case"
        size="small"
        aria-pressed={options.matchCase}
        onClick={() => setOptions({ ...options, matchCase: !options.matchCase })}
      />
      <IconButton
        icon={<WholeWord size={14} />}
        label="Match whole words"
        size="small"
        aria-pressed={options.wholeWord}
        onClick={() => setOptions({ ...options, wholeWord: !options.wholeWord })}
      />
      <span className={styles.count} aria-live="polite">
        {bar.countWords}
      </span>
      <IconButton icon={<ArrowUp size={14} />} label="Previous match" shortcut={hotkey('textFindPrevious')} size="small" disabled={!bar.hasMatches} onClick={() => bar.step(true)} />
      <IconButton icon={<ArrowDown size={14} />} label="Next match" shortcut={hotkey('textFindNext')} size="small" disabled={!bar.hasMatches} onClick={() => bar.step(false)} />
      <IconButton icon={<X size={14} />} label="Close" shortcut={hotkey('textCloseFind')} size="small" onClick={bar.close} />
    </div>
  );
}
