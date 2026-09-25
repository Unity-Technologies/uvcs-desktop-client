import { FolderOpen } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import styles from './HomeDialogs.module.css';

interface LocationFieldProps {
  path: string;
  onChange: (path: string) => void;
  onChoose: () => void;
}

/** The folder a workspace lives in: editable, or chosen with the system folder picker. */
export function LocationField({ path, onChange, onChoose }: LocationFieldProps) {
  return (
    <div className={styles.locationRow}>
      <div className={styles.locationField}>
        <TextField label="Location" value={path} onChange={(event) => onChange(event.target.value)} />
      </div>
      <Button icon={<FolderOpen size={14} />} onClick={onChoose}>
        Choose…
      </Button>
    </div>
  );
}
