import { MessageSquare, MessageSquareOff } from 'lucide-react';
import { IconButton } from '../../../ui/IconButton';

interface CommentsInCodeButtonProps {
  /** The comments show in the code; else they're folded into their lines' markers. */
  shown: boolean;
  onChange: (shown: boolean) => void;
}

/**
 * The file header's button that hides a review's comments from the code and shows them again, in the review's diff and
 * in See in context alike. An action that says what it does, not a pressed state: "Comments in the code" didn't say
 * which way it goes.
 */
export function CommentsInCodeButton({ shown, onChange }: CommentsInCodeButtonProps) {
  return (
    <IconButton
      icon={shown ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
      label={shown ? 'Hide comments in the code' : 'Show comments in the code'}
      onClick={() => onChange(!shown)}
    />
  );
}
