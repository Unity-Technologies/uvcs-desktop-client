import { KeyHints } from '../../ui/KeyHints';
import { focusModeHints } from './focusModeHints';

/** Focus mode's hints, a caption under the comment: what the triggers write, and the key for a link (`focusModeHints`). */
export function FocusModeFooter() {
  return <KeyHints caption hints={focusModeHints()} />;
}
