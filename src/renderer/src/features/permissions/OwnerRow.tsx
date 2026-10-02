import { RotateCcw } from 'lucide-react';
import type { MemberRef } from '@shared/domain/permissions';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { MemberIcon } from './MemberIcon';
import { memberLabel, type MemberRole } from './members';
import styles from './PermissionsDialog.module.css';

interface OwnerRowProps {
  owner: MemberRef | null;
  /** The owner the draft gives it, when another. */
  newOwner?: MemberRef;
  onChange: () => void;
  onUndo: () => void;
}

const roleOf = (member: MemberRef): MemberRole => (member.kind === 'group' ? 'group' : 'user');

/** Who owns the object, which the `OWNER` entry stands for, and Change… to give it to another user or group. */
export function OwnerRow({ owner, newOwner, onChange, onUndo }: OwnerRowProps) {
  const shown = newOwner ?? owner;
  return (
    <div className={styles.owner}>
      <span className={styles.ownerLabel}>Owner</span>
      {shown ? (
        <span className={styles.ownerName} data-changed={Boolean(newOwner)}>
          <MemberIcon name={shown.name} role={roleOf(shown)} />
          {memberLabel(shown.name)}
        </span>
      ) : (
        <span className={styles.ownerName}>Unknown</span>
      )}
      {newOwner && owner && <span className={styles.ownerWas}>was {memberLabel(owner.name)}</span>}
      {newOwner && <IconButton icon={<RotateCcw size={13} />} label="Keep the owner it has" size="small" onClick={onUndo} />}
      <Button size="small" onClick={onChange}>
        Change…
      </Button>
    </div>
  );
}
