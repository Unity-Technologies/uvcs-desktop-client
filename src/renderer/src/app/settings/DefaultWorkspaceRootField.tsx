import { FolderOpen } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../ui/Button';
import { useDefaultWorkspaceRoot } from '../home/useDefaultWorkspaceRoot';
import styles from './SettingsDialog.module.css';

interface DefaultWorkspaceRootFieldProps {
  value: string;
  onChange: (folder: string) => void;
}

export function DefaultWorkspaceRootField({ value, onChange }: DefaultWorkspaceRootFieldProps) {
  // The home folder until one is chosen, shown as the path it is.
  const folder = useDefaultWorkspaceRoot();
  const choose = async (): Promise<void> => {
    const picked = await api.system.pickDirectory('Folder for new workspaces', folder);
    if (picked) onChange(picked);
  };

  return (
    <div className={styles.folderRow}>
      <span className={styles.folder} data-tip={folder}>
        {folder}
      </span>
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
