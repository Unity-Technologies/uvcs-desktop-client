import { X } from 'lucide-react';
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { addTokens, afterBackspace, allTokens, typedTokens, withoutToken } from '../lib/tokenInput';
import styles from './TokenField.module.css';

interface TokenFieldProps {
  /** The values, one chip each. */
  tokens: string[];
  onChange: (tokens: string[]) => void;
  /** Names the field for screen readers ("File types"). */
  label: string;
  placeholder?: string;
  /** What the values may be, as the field's tooltip. */
  tip?: string;
  autoFocus?: boolean;
}

/**
 * A field of short values as chips that wrap onto more lines: a space, comma, semicolon or Enter makes what was typed a
 * chip (double quotes keep spaces in one), pasting splits into chips, Backspace in an empty field takes the last chip
 * away, and each chip's × removes it (by pointer; Backspace from the keyboard). What each key does is `lib/tokenInput`'s.
 */
export function TokenField({ tokens, onChange, label, placeholder, tip, autoFocus }: TokenFieldProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const add = (added: string[]): void => {
    if (added.length > 0) onChange(addTokens(tokens, added));
  };
  const type = (text: string): void => {
    const typed = typedTokens(text);
    add(typed.tokens);
    setInput(typed.rest);
  };
  const commit = (): void => {
    add(allTokens(input));
    setInput('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace') {
      const remaining = afterBackspace(tokens, input);
      if (remaining) {
        event.preventDefault();
        onChange(remaining);
      }
    }
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    event.preventDefault();
    add(allTokens(input + event.clipboardData.getData('text')));
    setInput('');
  };

  return (
    <div className={styles.field} role="group" aria-label={label} data-tip={tip} onClick={() => inputRef.current?.focus()}>
      {tokens.map((token, index) => (
        <span key={token} className={styles.chip}>
          <span className={styles.chipText}>{token}</span>
          {/* Out of the Tab order: Backspace takes chips away from the keyboard, and the field's input is what Tab reaches first. */}
          <button type="button" tabIndex={-1} className={styles.remove} aria-label={`Remove ${token}`} onClick={() => onChange(withoutToken(tokens, index))}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className={styles.input}
        aria-label={label}
        value={input}
        placeholder={tokens.length === 0 ? placeholder : undefined}
        spellCheck={false}
        autoFocus={autoFocus}
        onChange={(event) => type(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={commit}
      />
    </div>
  );
}
