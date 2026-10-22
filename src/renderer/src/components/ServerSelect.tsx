import { useServers } from '../app/workspace/workspaceQueries';
import { serverChoiceLabel } from '../lib/servers';
import { SelectField } from '../ui/TextField';

interface ServerSelectProps {
  value: string;
  onChange: (server: string) => void;
  disabled?: boolean;
}

/** One of the servers the user is signed in to, named as the sidebar names it. */
export function ServerSelect({ value, onChange, disabled }: ServerSelectProps) {
  const { data: servers } = useServers();

  return (
    <SelectField label="Server" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {(servers?.map((profile) => profile.server) ?? [value]).map((server) => (
        <option key={server} value={server}>
          {serverChoiceLabel(server)}
        </option>
      ))}
    </SelectField>
  );
}
