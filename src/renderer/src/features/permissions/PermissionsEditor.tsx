import { useCallback, useMemo, useState } from 'react';
import { APPLICABLE_PERMISSIONS, type ObjectPermissions, type PermissionName, type PermissionTarget } from '@shared/domain/permissions';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { hotkey } from '../../lib/shortcutRegistry';
import { HighlightQuery } from '../../ui/Highlight';
import { KeyHints } from '../../ui/KeyHints';
import { SearchField } from '../../ui/SearchField';
import { levelsAbove, readOwnBits, resolvePermissions, type OwnState } from './aclResolution';
import { MemberIcon } from './MemberIcon';
import { MemberList } from './MemberList';
import { pickMember } from './MemberPickerDialog';
import { cannotRemoveReason, memberRows, memberStatus, type MemberRow } from './members';
import { OwnerRow } from './OwnerRow';
import { groupPermissions, PERMISSION_INFO } from './permissionCatalog';
import { PermissionGrid } from './PermissionGrid';
import {
  addMember,
  draftBits,
  removeMember,
  savedChoices,
  setOverride,
  setOwner,
  setOwnState,
  type OverrideKind,
  type PermissionsDraft,
} from './permissionsDraft';
import { ownListNotice } from './permissionWords';
import styles from './PermissionsDialog.module.css';

interface PermissionsEditorProps {
  target: PermissionTarget;
  permissions: ObjectPermissions;
  /** The server's groups, which tell the entries that are groups from users. */
  groups: ReadonlySet<string>;
  draft: PermissionsDraft;
  onDraft: (draft: PermissionsDraft) => void;
}

/** The owner, the users and groups with an entry, and what the one picked may do here, all edited in the draft. */
export function PermissionsEditor({ target, permissions, groups, draft, onDraft }: PermissionsEditorProps) {
  const rows = memberRows(permissions, draft, groups);
  const [picked, setPicked] = useState(() => (rows.find((row) => row.setHere) ?? rows[0])?.member.name);
  const selected = rows.find((row) => row.member.name === picked) ?? rows[0];
  const isServer = target.kind === 'server';
  // A path nobody secured has no owner until its first permission secures it.
  const ownable = !(target.kind === 'path' && !permissions.ownAcl);
  const notice = ownListNotice(target, permissions);

  const addSomeone = async (): Promise<void> => {
    const member = await pickMember({
      server: target.server,
      title: 'Add a user or group',
      description: 'Its entry starts empty, following what the lists above say: then set what it may do.',
      listed: new Set(rows.map((row) => row.member.name)),
      specials: true,
    });
    if (!member) return;
    onDraft(addMember(draft, member));
    setPicked(member.name);
  };

  const changeOwner = async (): Promise<void> => {
    const owner = await pickMember({ server: target.server, title: 'Change the owner', description: 'The Owner entry stands for whoever owns it.' });
    if (owner) onDraft(setOwner(draft, owner));
  };

  const remove = (row: MemberRow): void => {
    const index = rows.indexOf(row);
    onDraft(removeMember(draft, row.member));
    setPicked((rows[index + 1] ?? rows[index - 1])?.member.name);
  };

  return (
    <div className={styles.editor}>
      {ownable && <OwnerRow owner={permissions.owner} newOwner={draft.owner} onChange={() => void changeOwner()} onUndo={() => onDraft(setOwner(draft, undefined))} />}
      {notice && <p className={styles.notice}>{notice}</p>}
      <div className={styles.panes}>
        <MemberList
          rows={rows}
          selected={selected?.member.name}
          onSelect={setPicked}
          onAdd={() => void addSomeone()}
          onRemove={remove}
          removeReason={(row) => cannotRemoveReason(row, permissions, isServer, rows)}
        />
        {selected ? (
          <MemberPermissions key={selected.member.name} target={target} permissions={permissions} row={selected} draft={draft} onDraft={onDraft} />
        ) : (
          <p className={styles.emptyNote}>Nobody has an entry yet: add a user or group.</p>
        )}
      </div>
    </div>
  );
}

interface MemberPermissionsProps {
  target: PermissionTarget;
  permissions: ObjectPermissions;
  row: MemberRow;
  draft: PermissionsDraft;
  onDraft: (draft: PermissionsDraft) => void;
}

// In the order of the choices (`OWN_STATES`), then the overrides menu where there are lists above.
const CHOICE_HINTS = [
  { keys: hotkey('permissionInherit'), label: 'inherit' },
  { keys: hotkey('permissionAllow'), label: 'allow' },
  { keys: hotkey('permissionDeny'), label: 'deny' },
];
const OVERRIDES_HINT = { keys: hotkey('permissionMenu'), label: 'overrides' };

/** What one member may do here: every permission that applies to the object, under its group. */
function MemberPermissions({ target, permissions, row, draft, onDraft }: MemberPermissionsProps) {
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState<PermissionName>();
  const applicable = APPLICABLE_PERMISSIONS[target.kind];
  const name = row.member.name;
  const own = draftBits(permissions, draft, name);
  const resolutions = useMemo(() => resolvePermissions(permissions, name, own, applicable), [permissions, name, own, applicable]);
  const saved = useMemo(() => savedChoices(readOwnBits(permissions, name), own, applicable), [permissions, name, own, applicable]);
  const groups = groupPermissions(applicable.filter((permission) => matchesWordFilter([PERMISSION_INFO[permission].label, permission], filter)));
  const shown = groups.flatMap((group) => group.permissions);

  const set = useCallback((permission: PermissionName, state: OwnState) => onDraft(setOwnState(permissions, draft, row.member, [permission], state)), [permissions, draft, row.member, onDraft]);
  const override = useCallback(
    (permission: PermissionName, kind: OverrideKind, on: boolean) => onDraft(setOverride(permissions, draft, row.member, permission, kind, on)),
    [permissions, draft, row.member, onDraft],
  );
  const setAll = (state: OwnState): void => onDraft(setOwnState(permissions, draft, row.member, shown, state));
  const allWord = filter.trim() ? 'shown' : 'all';
  const shownActive = active && shown.includes(active) ? active : undefined;
  const hasAbove = levelsAbove(permissions).length > 0;

  return (
    <section className={styles.permissionsPane} aria-label={`What ${row.label} may do`}>
      <header className={styles.memberHeader}>
        <MemberIcon name={name} role={row.role} size={28} />
        <span className={styles.memberText}>
          <span className={styles.memberHeading}>{row.label}</span>
          <span className={styles.memberStatus}>{memberStatus(row)}</span>
        </span>
        <span className={styles.gridTools}>
          <SearchField value={filter} onChange={setFilter} placeholder="Filter permissions" width={200} />
        </span>
      </header>
      <HighlightQuery query={filter}>
        {shown.length > 0 ? (
          <PermissionGrid
            groups={groups}
            resolutions={resolutions}
            savedChoices={saved}
            hasAbove={hasAbove}
            active={shownActive}
            onActivate={setActive}
            onSet={set}
            onOverride={override}
            onSetAll={setAll}
            setAllScope={allWord}
          />
        ) : (
          <p className={styles.emptyNote}>No matching permissions</p>
        )}
      </HighlightQuery>
      {shown.length > 0 && <KeyHints hints={hasAbove ? [...CHOICE_HINTS, OVERRIDES_HINT] : CHOICE_HINTS} />}
    </section>
  );
}
