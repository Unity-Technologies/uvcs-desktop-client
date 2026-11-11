import { Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ChangedLine } from './changeBlocks';
import type { LineAction } from './diffAnnotations';
import type { HoveredLineStore } from './LineDiscardButton';
import { keepPointerDownToItself } from './pierreDom';
import styles from './LineActionButton.module.css';

type LineHoverOptions = Pick<FileDiffOptions<undefined, undefined>, 'onLineEnter' | 'onLineLeave'>;

type LineActionOptions = Pick<FileDiffOptions<undefined, undefined>, 'enableGutterUtility'> & LineHoverOptions;

/**
 * The place's line action (`DiffAnnotations.lineAction`, a review's "Comment on line 42") as a button in the gutter of
 * the line under the pointer, on the lines it takes. `hovers`: what else follows the pointer over the lines (the hint on
 * line numbers, `useLineLinks`), which Pierre takes as one pair of callbacks.
 */
export function useLineActionButton(action: LineAction | undefined, hovers: LineHoverOptions): { options: LineActionOptions; renderGutterUtility?: () => ReactNode } {
  const [hovered] = useState<HoveredLineStore>(() => createStore<ChangedLine | null>(() => null));
  const options = useMemo<LineActionOptions>(() => {
    if (!action) return {};
    return {
      enableGutterUtility: true,
      onLineEnter: (props) => {
        hovers.onLineEnter?.(props);
        const line = { side: props.annotationSide, lineNumber: props.lineNumber };
        hovered.setState(action.offers(line) ? line : null, true);
      },
      onLineLeave: (props) => {
        hovers.onLineLeave?.(props);
        hovered.setState(null, true);
      },
    };
  }, [action, hovers, hovered]);
  if (!action) return { options };
  return { options, renderGutterUtility: () => <LineActionGutterButton hovered={hovered} action={action} /> };
}

function LineActionGutterButton({ hovered, action }: { hovered: HoveredLineStore; action: LineAction }) {
  const line = useStore(hovered);
  if (!line) return null;
  const label = action.label(line);
  return (
    <div className={styles.slot}>
      <button type="button" ref={keepPointerDownToItself} className={styles.button} data-tip={label} aria-label={label} onClick={() => action.run(line)}>
        <Plus size={12} strokeWidth={2.75} aria-hidden />
      </button>
    </div>
  );
}
