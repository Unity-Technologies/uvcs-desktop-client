import { MessageSquare, MessageSquareOff } from 'lucide-react';
import { IconButton } from '../../../ui/IconButton';
import { commentsToggleLabel, type CommentsPlace } from './commentsToggle';

interface CommentsInCodeButtonProps {
  /** The comments show in the code; else they're folded into their lines' markers. */
  shown: boolean;
  onChange: (shown: boolean) => void;
  /** Where the file's comments are: its code (the default), its image, or both. */
  place?: CommentsPlace;
}

/**
 * The file header's button that hides a review's comments from the code and shows them again, in the review's diff and
 * in See in context alike. An action that says what it does, not a pressed state: "Comments in the code" didn't say
 * which way it goes.
 */
export function CommentsInCodeButton({ shown, onChange, place = 'code' }: CommentsInCodeButtonProps) {
  return (
    <IconButton
      icon={shown ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
      label={commentsToggleLabel(shown, place)}
      onClick={() => onChange(!shown)}
    />
  );
}
