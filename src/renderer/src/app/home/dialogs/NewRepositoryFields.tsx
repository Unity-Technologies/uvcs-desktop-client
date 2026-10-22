import { serverChoiceLabel } from '../../../lib/servers';
import { SelectField, TextField } from '../../../ui/TextField';
import { useServers } from '../../workspace/workspaceQueries';
import styles from './HomeDialogs.module.css';

interface NewRepositoryFieldsProps {
  server: string;
  onServerChange: (server: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  nameTaken: boolean;
  /** The repository exists already (an earlier try made it): it can no longer change. */
  locked: boolean;
}

/** The server and name of a repository to create, side by side as `RepositoryPicker` lays out its choice. */
export function NewRepositoryFields({ server, onServerChange, name, onNameChange, nameTaken, locked }: NewRepositoryFieldsProps) {
  const { data: servers } = useServers();

  return (
    <div className={styles.repositoryRow}>
      <SelectField label="Server" value={server} disabled={locked} onChange={(event) => onServerChange(event.target.value)}>
        {(servers?.map((profile) => profile.server) ?? [server]).map((serverName) => (
          <option key={serverName} value={serverName}>
            {serverChoiceLabel(serverName)}
          </option>
        ))}
      </SelectField>
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
