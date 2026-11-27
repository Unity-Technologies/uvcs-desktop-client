import { Keyboard, RotateCcw } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { keyChoice, withDefaultKeys, withShortcutKey, type CustomShortcuts } from '@shared/shortcuts/keymap';
import type { ShortcutId } from '@shared/shortcuts/shortcutRegistry';
import { useKeymap } from '../../../lib/keymapStore';
import { TAKES_ESCAPE } from '../../../lib/modalDialog';
import { isMac } from '../../../lib/platform';
import { formatShortcut } from '../../../lib/shortcuts';
import { Button } from '../../../ui/Button';
import { confirm } from '../../../ui/dialog/confirm';
import { Highlight, HighlightQuery } from '../../../ui/Highlight';
import { IconButton } from '../../../ui/IconButton';
import { Kbd } from '../../../ui/Kbd';
import { SearchField } from '../../../ui/SearchField';
import { saveSettings, useSettings } from '../useSettings';
import { findKey, findTakesEscape, keyboardPaneState, keyboardRows, pressOutcome, resetOutcome, type KeyboardFilter, type KeyNote } from './keyboardRows';
import { ShortcutKeysButton } from './ShortcutKeysButton';
import styles from './KeyboardPane.module.css';

/**
 * What waits on a row's "Use it here", or the note it left: a key pressed for its shortcut, or the keys it came with
 * being given back (which the note names by the shortcuts that use them now).
 */
type Pressed = { id: ShortcutId; note: KeyNote } & ({ gives: 'key'; key: string } | { gives: 'defaults' });

/**
 * Settings ▸ Keyboard: the shortcuts a person may change, found by name or by keys, each given new keys by pressing
 * them; a key another shortcut has asks first, and one that can't be used says why (docs/features/keyboard-shortcuts.md).
 */
export function KeyboardPane() {
  const { customShortcuts: custom } = useSettings();
  const keymap = useKeymap();
  const [text, setText] = useState('');
  const [findByKeys, setFindByKeys] = useState(false);
  const [keyFound, setKeyFound] = useState<string | null>(null);
  const [recording, setRecording] = useState<ShortcutId | null>(null);
  const [pressed, setPressed] = useState<Pressed | null>(null);
  const keysButtons = useRef(new Map<ShortcutId, HTMLButtonElement>());
  const findField = useRef<HTMLInputElement>(null);

  const filter: KeyboardFilter = findByKeys ? { by: 'key', key: keyFound } : { by: 'words', text };
  const save = (changed: CustomShortcuts): Promise<void> => saveSettings({ customShortcuts: changed });

  const stopRecording = (): void => {
    setRecording(null);
    setPressed((current) => (current?.note.tone === 'info' ? current : null));
  };

  const give = (id: ShortcutId, key: string | null): void => {
    void save(withShortcutKey(custom, keymap, id, key, isMac));
    setRecording(null);
    setPressed(null);
    keysButtons.current.get(id)?.focus();
  };

  const onPressed = (id: ShortcutId, key: string): void => {
    const outcome = pressOutcome(id, keyChoice(id, key, keymap, isMac));
    if (outcome.gives) give(id, key);
    else if (!outcome.keepsRecording) setRecording(null);
    setPressed(outcome.note && { id, key, note: outcome.note, gives: 'key' });
  };

  const giveDefaults = (id: ShortcutId): void => {
    void save(withDefaultKeys(custom, keymap, id, isMac));
    setPressed(null);
  };

  const onReset = (id: ShortcutId): void => {
    const outcome = resetOutcome(id, keymap, isMac);
    if (outcome.gives) giveDefaults(id);
    else setPressed({ id, note: outcome.note, gives: 'defaults' });
  };

  const resetAll = async (): Promise<void> => {
    const reset = await confirm({ title: 'Reset all shortcuts?', message: 'Every shortcut takes the keys it came with again.', confirmLabel: 'Reset all' });
    if (reset) void save({});
  };

  const onFindKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!findByKeys) return;
    const pressedKey = findKey(event.nativeEvent, keyFound, isMac);
    if (pressedKey.action === 'leave') return;
    event.preventDefault();
    if (pressedKey.action === 'record') setKeyFound(pressedKey.key);
    else if (pressedKey.action === 'clear') setKeyFound(null);
    else if (pressedKey.action === 'findByName') setFindByKeys(false);
  };

  const rows = keyboardRows(keymap, custom, filter, isMac);
  const { emptyText, resetsAll } = keyboardPaneState(rows.length, filter, custom);

  return (
    <div className={styles.pane}>
      <div className={styles.find} {...(findTakesEscape(filter) && TAKES_ESCAPE)}>
        <SearchField
          ref={findField}
          value={findByKeys ? (keyFound ? formatShortcut(keyFound).join('') : '') : text}
          onChange={(value) => (findByKeys ? setKeyFound(null) : setText(value))}
          onKeyDown={onFindKeyDown}
          placeholder={findByKeys ? 'Press keys to find them, or Esc to find by name' : 'Find a shortcut'}
          aria-label={findByKeys ? 'Press keys to find them' : 'Find a shortcut'}
          width="100%"
        />
        <IconButton
          icon={<Keyboard size={14} />}
          label="Find by keys"
          aria-pressed={findByKeys}
          variant={findByKeys ? 'secondary' : 'ghost'}
          onClick={() => {
            setFindByKeys(!findByKeys);
            setKeyFound(null);
            findField.current?.focus();
          }}
        />
      </div>

      <div className={styles.list}>
        <HighlightQuery query={findByKeys ? '' : text}>
          {rows.map(([area, areaRows]) => (
            <section key={area} className={styles.area} aria-label={area}>
              <h3 className={styles.areaHeading}>{area}</h3>
              {areaRows.map((row) => (
                <div key={row.id} className={styles.rowBlock}>
                  <div className={styles.row}>
                    <span className={styles.label} data-changed={row.changed || undefined}>
                      <Highlight text={row.label} />
                    </span>
                    <ShortcutKeysButton
                      ref={(button) => {
                        if (button) keysButtons.current.set(row.id, button);
                        else keysButtons.current.delete(row.id);
                      }}
                      label={row.label}
                      keys={row.keys}
                      changed={row.changed}
                      recording={recording === row.id}
                      onRecord={() => {
                        setPressed(null);
                        setRecording(row.id);
                      }}
                      onPressed={(key) => onPressed(row.id, key)}
                      onStop={stopRecording}
                    />
                    {row.changed ? (
                      <IconButton
                        size="small"
                        icon={<RotateCcw size={12} />}
                        label="Use the keys it came with"
                        onClick={() => onReset(row.id)}
                      />
                    ) : (
                      <span className={styles.resetSlot} />
                    )}
                  </div>
                  {recording === row.id && !pressed && (
                    <RowNote tone="info">
                      Esc to cancel.
                      {row.removable && <NoteButton onClick={() => give(row.id, null)}>Remove the shortcut</NoteButton>}
                    </RowNote>
                  )}
                  {pressed?.id === row.id && (
                    <RowNote tone={pressed.note.tone}>
                      <Kbd keys={pressed.gives === 'key' ? pressed.key : undefined} /> {pressed.note.text}
                      {pressed.note.tone === 'confirm' && (
                        <>
                          <NoteButton
                            onClick={() => (pressed.gives === 'key' ? give(row.id, pressed.key) : giveDefaults(row.id))}
                          >
                            Use it here
                          </NoteButton>
                          <NoteButton onClick={() => setPressed(null)}>Cancel</NoteButton>
                        </>
                      )}
                    </RowNote>
                  )}
                </div>
              ))}
            </section>
          ))}
        </HighlightQuery>
        {emptyText && <p className={styles.none}>{emptyText}</p>}
      </div>

      {resetsAll && (
        <div className={styles.footer}>
          <Button size="small" onClick={() => void resetAll()}>
            Reset all shortcuts
          </Button>
        </div>
      )}
    </div>
  );
}

function RowNote({ tone, children }: { tone: KeyNote['tone']; children: ReactNode }) {
  return (
    <p className={styles.note} data-tone={tone} role="status">
      {children}
    </p>
  );
}

/** A note's action: it keeps the focus where it is, so the keys being recorded aren't dropped as it's clicked. */
function NoteButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={styles.noteButton} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}
