import type { MouseEvent, RefObject } from 'react';
import { changeMapClick, changeMarkLabel, holdsChange } from './changeMarks';
import type { ChangeMapView } from './useChangeMap';
import styles from './ChangeMap.module.css';

interface ChangeMapProps {
  view: ChangeMapView;
  /** How many changes the diff has, for the marks' tooltips ("Change 3 of 12"). */
  count: number;
  /** The change moved to last (`StepNavigation.current`), whose mark stands out. */
  current: number | null;
  /** Moves to a change as the arrows would (`StepNavigation.goTo`). */
  onGoTo: (index: number) => void;
  /** The diff's scrolling element, scrolled to the point clicked between marks. */
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * The change map: a lane beside the diff's vertical scrollbar marking where its changes are, colored by what each does.
 * A click on a mark goes to its change, through the arrows' navigation ("3 of 12", the change lit); a click between
 * marks scrolls there. The keys and the arrows already reach every change, so it's for the pointer only.
 *
 * It's inside the diff's scrolling element, first, standing still at its top (`ChangeMap.module.css`), so the wheel
 * over it scrolls the diff as anywhere else. A press on it takes no focus, and it's no press in the diff: the caret
 * typing in the diff stays where it was, and the lines aren't picked.
 */
export function ChangeMap({ view, count, current, onGoTo, containerRef }: ChangeMapProps) {
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const click = changeMapClick(view.marks, y, { contentHeight: view.contentHeight, stripHeight: view.viewHeight, viewHeight: view.viewHeight });
    if (click.to === 'change') onGoTo(click.index);
    else containerRef.current?.scrollTo({ top: click.scrollTop });
  };
  return (
    <div
      className={styles.map}
      style={{ height: view.viewHeight, marginBottom: -view.viewHeight }}
      aria-hidden
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      {view.marks.map((mark) => (
        <div
          key={mark.first}
          className={styles.mark}
          style={{ top: mark.top, height: mark.height }}
          data-kind={mark.kind}
          data-current={holdsChange(mark, current) ? '' : undefined}
          data-tip={changeMarkLabel(mark, count)}
        />
      ))}
    </div>
  );
}
