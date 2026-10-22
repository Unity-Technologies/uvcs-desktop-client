import { TextField } from '../ui/TextField';
import styles from './RepositoryPicker.module.css';
import { ServerSelect } from './ServerSelect';

interface NewRepositoryFieldsProps {
  server: string;
  onServerChange: (server: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  nameTaken: boolean;
  /** The repository exists already (an earlier try made it): it can no longer change. */
  locked: boolean;
}

/**
 * The server and name of a repository to create, laid out as `RepositoryPicker` lays out a repository to pick. It lives
 * next to the picker to share its layout (`RepositoryPicker.module.css`), so the two line up where a dialog swaps them.
 */
export function NewRepositoryFields({ server, onServerChange, name, onNameChange, nameTaken, locked }: NewRepositoryFieldsProps) {
  return (
    <div className={styles.picker}>
      <ServerSelect value={server} onChange={onServerChange} disabled={locked} />
      <TextField
        label="Repository name"
        value={name}
        readOnly={locked}
        error={nameTaken ? 'There is already a repository with this name.' : undefined}
        onChange={(event) => onNameChange(event.target.value)}
        autoFocus
      />
    </div>
  );
}
