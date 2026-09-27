import { Scissors } from 'lucide-react';
import { pluralize } from '../../lib/text';
import { Kbd } from '../../ui/Kbd';
import { useCutItems, useCutItemsStore } from './cutItemsStore';
import { CUT_PASTE_SHORTCUTS } from './cutPasteActions';
import styles from './CutHint.module.css';

/** While items are cut: how many, and the keys that paste or cancel them ("2 items cut · ⌘V paste into a folder · Esc cancel"). */
export function CutHint({ workspacePath }: { workspacePath: string }) {
  const cut = useCutItems(workspacePath);
  if (cut.length === 0) return null;

  return (
    <div className={styles.hint} role="status">
      <Scissors size={13} />
      <span className={styles.count}>{pluralize(cut.length, 'item')} cut</span>
      <span className={styles.key}>
        <Kbd keys={CUT_PASTE_SHORTCUTS.paste} /> paste into a folder
      </span>
      <button type="button" className={styles.key} data-tip="Cancel the cut" onClick={() => useCutItemsStore.getState().clear()}>
        <Kbd keys={CUT_PASTE_SHORTCUTS.cancel} /> cancel
      </button>
    </div>
  );
}
