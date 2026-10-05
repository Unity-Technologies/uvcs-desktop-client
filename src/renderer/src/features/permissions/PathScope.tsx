import { useState } from 'react';
import type { PermissionTarget } from '@shared/domain/permissions';
import { Button } from '../../ui/Button';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TextField } from '../../ui/TextField';
import { pathTarget } from './permissionTargets';
import styles from './PermissionsDialog.module.css';

type Scope = 'all' | 'group';

interface PathScopeProps {
  target: PermissionTarget;
  /** Shows another path, or another group of branches of it. */
  onShow: (target: PermissionTarget) => void;
}

/**
 * Which path the dialog shows, and on which branches: all of them, or a group of branches named by its tag
 * (`path:/src#release`). `cm` lists neither the secured paths nor their groups, so both are typed.
 */
export function PathScope({ target, onShow }: PathScopeProps) {
  const [path, setPath] = useState(target.name);
  const [scope, setScope] = useState<Scope>(target.tag ? 'group' : 'all');
  const [tag, setTag] = useState(target.tag ?? '');
  const next = pathTarget(target.repository!, path, scope === 'group' ? tag : undefined);
  const unchanged = next.name === target.name && next.tag === target.tag;
  const missingTag = scope === 'group' && !tag.trim();

  const show = (): void => {
    if (!unchanged && !missingTag) onShow(next);
  };

  return (
    <div
      className={styles.pathScope}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
        event.preventDefault();
        show();
      }}
    >
      <TextField aria-label="Path" className={styles.pathField} value={path} placeholder="/" onChange={(event) => setPath(event.target.value)} />
      <SegmentedControl<Scope>
        label="On which branches"
        value={scope}
        onChange={setScope}
        segments={[
          { value: 'all', label: 'All branches' },
          { value: 'group', label: 'A group of branches', title: 'Permissions for some branches only, named by a tag' },
        ]}
      />
      {scope === 'group' && <TextField aria-label="Tag of the group" className={styles.tagField} value={tag} placeholder="Tag, e.g. release" onChange={(event) => setTag(event.target.value)} />}
      <Button size="small" disabled={unchanged || missingTag} onClick={show}>
        Show
      </Button>
    </div>
  );
}
