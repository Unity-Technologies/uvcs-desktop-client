import { KeyHints } from '../../ui/KeyHints';
import { focusModeHints } from './focusModeHints';

/** The comment editor's hints, a caption under the comment on one line: what the triggers write (`focusModeHints`). */
export function FocusModeFooter() {
  return <KeyHints caption oneLine hints={focusModeHints()} />;
}
