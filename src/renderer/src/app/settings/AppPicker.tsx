import { ChevronDown } from 'lucide-react';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { appPickerEntries, pickedApp, type AppPickerChoices } from './appPickerChoices';
import styles from './SettingsDialog.module.css';

interface AppPickerProps extends AppPickerChoices {
  label: string;
  /** One line, the app's name alone (where it is in the tooltip): a row of a table of choices. */
  compact?: boolean;
}

/** One app setting as a drop-down: a long list of apps found stays out of the way of the settings below it. */
export function AppPicker({ label, compact = false, ...choices }: AppPickerProps) {
  const picked = pickedApp(choices);
  const PickedIcon = picked.icon;
  return (
    <ActionDropdownMenu entries={appPickerEntries(choices)} align="start">
      <button
        type="button"
        className={compact ? styles.pickerCompact : styles.picker}
        aria-label={`${label}: ${picked.label}`}
        data-tip={compact ? picked.description : undefined}
      >
        <span className={styles.pickerIcon}>{PickedIcon && <PickedIcon size={compact ? 16 : 18} />}</span>
        <span className={styles.choiceText}>
          <span className={`${styles.choiceLabel} ${styles.oneLine}`}>
            {picked.label}
            {compact && picked.detail && <span className={styles.pickedDetail}>{picked.detail}</span>}
          </span>
          {!compact && (
            <span className={`${styles.choiceDescription} ${styles.oneLine}`} data-tip={picked.description}>
              {picked.description}
            </span>
          )}
        </span>
        <ChevronDown size={14} />
      </button>
    </ActionDropdownMenu>
  );
}
