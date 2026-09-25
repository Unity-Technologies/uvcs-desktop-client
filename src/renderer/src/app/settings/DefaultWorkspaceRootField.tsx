import { FolderOpen } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import styles from './SettingsDialog.module.css';

interface DefaultWorkspaceRootFieldProps {
  value: string;
  onChange: (folder: string) => void;
}

export function DefaultWorkspaceRootField({ value, onChange }: DefaultWorkspaceRootFieldProps) {
  const choose = async (): Promise<void> => {
    const folder = await api.system.pickDirectory('Folder for new workspaces', value || undefined);
    if (folder) onChange(folder);
  };

  return (
    <div className={styles.folderRow}>
      <span className={styles.folder}>{value || 'Home folder'}</span>
      <Button size="small" icon={<FolderOpen size={13} />} onClick={() => void choose()}>
        Choose…
      </Button>
      {value && (
        <Button size="small" variant="ghost" onClick={() => onChange('')}>
          Reset
        </Button>
      )}
    </div>
  );
}
