import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { addTokens, allTokens, tokenKey, typedTokens, withoutToken, type TokenFocus } from '../lib/tokenInput';
import styles from './TokenField.module.css';

interface TokenFieldProps {
  /** The values, one chip each. */
  tokens: string[];
  onChange: (tokens: string[]) => void;
  /** What's typed but not a chip yet, as it changes: a form counts it, and makes it chips on submit. */
  onPendingChange?: (text: string) => void;
  /** Names the field for screen readers ("File types"), when no visible label does (`labelledBy`). */
  label: string;
  /** The id of the field's visible label, which names it for screen readers. */
  labelledBy?: string;
  placeholder?: string;
  /** What the values may be, as the field's tooltip. */
  tip?: string;
  autoFocus?: boolean;
}

/**
 * A field of short values as chips that wrap onto more lines: a space, comma, semicolon or Enter makes what was typed a
 * chip (double quotes keep spaces in one), pasting splits into chips, and each chip's × removes it. From the keyboard,
 * Backspace in an empty field takes the last chip away, ArrowLeft moves onto the chips and Backspace or Delete removes
 * the one it's on (`tokenKey`): the chips are out of the Tab order, the input is what Tab reaches.
 */
export function TokenField({ tokens, onChange, onPendingChange, label, labelledBy, placeholder, tip, autoFocus }: TokenFieldProps) {
  const [input, setTypedInput] = useState('');
  const setInput = (text: string): void => {
    setTypedInput(text);
    onPendingChange?.(text);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // Where the keyboard goes once the chips are drawn again after a key changed them.
  const [focusAfter, setFocusAfter] = useState<TokenFocus | null>(null);
  useEffect(() => {
    if (focusAfter === null) return;
    (focusAfter === 'input' ? inputRef.current : chipRefs.current[focusAfter])?.focus();
    setFocusAfter(null);
  }, [focusAfter]);
  const naming = labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': label };
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
  const onKey = (event: KeyboardEvent<HTMLElement>, focus: TokenFocus): void => {
    if (focus === 'input' && event.key === 'Enter') {
      event.preventDefault();
      commit();
      return;
    }
    const result = tokenKey(event.key, focus, tokens, input);
    if (!result) return;
    event.preventDefault();
    if (result.tokens.length !== tokens.length) onChange(result.tokens);
    setFocusAfter(result.focus);
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    event.preventDefault();
    add(allTokens(input + event.clipboardData.getData('text')));
    setInput('');
  };

  return (
    <div className={styles.field} role="group" {...naming} data-tip={tip} onClick={(event) => event.target === event.currentTarget && inputRef.current?.focus()}>
      {tokens.map((token, index) => (
        <span
          key={token}
          ref={(element) => {
            chipRefs.current[index] = element;
          }}
          className={styles.chip}
          tabIndex={-1}
          aria-label={token}
          onKeyDown={(event) => onKey(event, index)}
        >
          <span className={styles.chipText}>{token}</span>
          <button type="button" tabIndex={-1} className={styles.remove} aria-label={`Remove ${token}`} onClick={() => onChange(withoutToken(tokens, index))}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className={styles.input}
        {...naming}
        value={input}
        placeholder={tokens.length === 0 ? placeholder : undefined}
        spellCheck={false}
        autoFocus={autoFocus}
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => onKey(event, 'input')}
        onPaste={onPaste}
        onBlur={commit}
      />
    </div>
  );
}
