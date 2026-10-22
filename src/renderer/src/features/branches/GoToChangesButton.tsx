import { navigation } from '../../app/navigation/navigationStore';
import { Button } from '../../ui/Button';
import { Tooltip } from '../../ui/Tooltip';
import styles from './GoToChangesButton.module.css';

/**
 * "Go to Changes" in the footer of a dialog that asks what happens to the pending changes: closes the dialog
 * (`dismiss`, so nothing happens) and opens Changes.
 */
export function GoToChangesButton({ dismiss }: { dismiss: () => void }) {
  return (
    <Tooltip content="Closes this and shows your pending changes">
      <Button
        variant="ghost"
        className={styles.goToChanges}
        onClick={() => {
          dismiss();
          navigation.goToView('changes');
        }}
      >
        Go to Changes
      </Button>
    </Tooltip>
  );
}
