import { FolderOpen } from 'lucide-react';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import styles from './HomeDialogs.module.css';

interface LocationFieldProps {
  path: string;
  onChange: (path: string) => void;
  /** The system folder picker's title: "Choose the workspace folder". */
  pickerTitle: string;
  /** The folder the picker opens in; the path typed when not given. */
  pickerFolder?: string;
  label?: string;
  disabled?: boolean;
}

/** The folder a workspace lives in: editable, or chosen with the system folder picker. */
export function LocationField({ path, onChange, pickerTitle, pickerFolder, label = 'Location', disabled }: LocationFieldProps) {
  const choose = async (): Promise<void> => {
    const picked = await api.system.pickDirectory(pickerTitle, pickerFolder ?? (path || undefined));
    if (picked) onChange(picked);
  };

  return (
    <div className={styles.locationRow}>
      <div className={styles.locationField}>
        <TextField label={label} value={path} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </div>
      <Button icon={<FolderOpen size={14} />} onClick={() => void choose()} disabled={disabled}>
        Choose…
      </Button>
    </div>
  );
}
