import { Minus, Undo2 } from 'lucide-react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { ChangedLine } from './changeBlocks';
import { lineActionLabel } from './discardAction';
import styles from './LineDiscardButton.module.css';

/** The changed line under the pointer, if any. */
export type HoveredLineStore = StoreApi<ChangedLine | null>;

interface LineDiscardButtonProps {
  hovered: HoveredLineStore;
  /** Lines picked in the gutter: the change's chip acts on them, so they show no button of their own. */
  picked: ChangedLine[] | null;
  /** The line the button would discard while the pointer is on it, to preview the result. */
  onPreview: (lines: ChangedLine[] | null) => void;
  onDiscard: (lines: ChangedLine[]) => void;
}

/** In the gutter of the changed line under the pointer: removes that one added line, or restores that one removed line. */
export function LineDiscardButton({ hovered, picked, onPreview, onDiscard }: LineDiscardButtonProps) {
  const line = useStore(hovered);
  if (!line || picked?.some((each) => each.side === line.side && each.lineNumber === line.lineNumber)) return null;

  const label = lineActionLabel(line);
  return (
    <div className={styles.slot}>
      <button
        type="button"
        // The diff picks the line pressed in its gutter: pressing the button isn't picking.
        ref={keepPointerDownToItself}
        className={styles.button}
        data-kind={line.side === 'additions' ? 'remove' : 'restore'}
        data-tip={label}
        aria-label={label}
        onPointerEnter={() => onPreview([line])}
        onPointerLeave={() => onPreview(null)}
        onClick={() => onDiscard([line])}
      >
        {line.side === 'additions' ? <Minus size={12} strokeWidth={2.5} /> : <Undo2 size={12} strokeWidth={2.25} />}
      </button>
    </div>
  );
}

/** Native, since the diff listens in its shadow root, before React sees the event. */
function keepPointerDownToItself(button: HTMLButtonElement | null): (() => void) | undefined {
  if (!button) return undefined;
  const stop = (event: PointerEvent): void => event.stopPropagation();
  button.addEventListener('pointerdown', stop);
  return () => button.removeEventListener('pointerdown', stop);
}
