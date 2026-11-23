import { Plus } from 'lucide-react';
import type { CSSProperties, PointerEvent, Ref } from 'react';
import { Avatar } from '../../../../ui/Avatar';
import type { CommentPin } from './commentPin';
import styles from './CommentPins.module.css';

interface PinBubbleProps {
  pin: CommentPin<unknown>;
  selected: boolean;
  /** Where it is: its tip on the spot, set by the viewer that places it (a translate). */
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
  /** The viewer's own class beside the bubble's, for what its styles say of the bubble (a glide, its area on hover). */
  className?: string;
  /** A movable pin's drag starts here. */
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  onClick: () => void;
}

/**
 * A pin's bubble: the avatar of who started the thread, its tip at the spot, as a comment on a canvas reads in design
 * tools; a plus for a comment being written. Always white, so it reads over anything; where the thread stands is a
 * mark on it (`CommentPins.module.css`).
 */
export function PinBubble({ pin, selected, style, ref, className, onPointerDown, onClick }: PinBubbleProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={className ? `${styles.pin} ${className}` : styles.pin}
      data-emphasized={pin.emphasized || undefined}
      data-earlier={pin.earlier || undefined}
      data-selected={selected || undefined}
      data-writing={pin.author === null || undefined}
      data-movable={pin.movable || undefined}
      data-tip={pin.tip}
      aria-label={pin.tip}
      aria-pressed={selected}
      style={style}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {pin.author === null ? <Plus size={16} strokeWidth={2.5} aria-hidden /> : <Avatar user={pin.author} size={22} tip={null} />}
    </button>
  );
}
