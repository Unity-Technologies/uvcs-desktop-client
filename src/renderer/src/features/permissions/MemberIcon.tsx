import { Crown, Globe, Users } from 'lucide-react';
import { Avatar } from '../../ui/Avatar';
import type { MemberRole } from './members';
import styles from './MemberIcon.module.css';

const ROLE_TIPS: Record<Exclude<MemberRole, 'user'>, string> = {
  owner: 'Whoever owns it',
  everyone: 'Every user',
  group: 'Group',
};

/** A user's avatar; a group, everyone and the owner each with an icon of their own. */
export function MemberIcon({ name, role, size = 20 }: { name: string; role: MemberRole; size?: number }) {
  if (role === 'user') return <Avatar user={name} size={size} tip={null} />;
  const Icon = role === 'owner' ? Crown : role === 'everyone' ? Globe : Users;
  return (
    <span className={styles.icon} data-role={role} style={{ width: size, height: size }} data-tip={ROLE_TIPS[role]} aria-hidden>
      <Icon size={Math.round(size * 0.6)} />
    </span>
  );
}
