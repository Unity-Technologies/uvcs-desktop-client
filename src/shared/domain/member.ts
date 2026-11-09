/** Whether a name is a user's or a group's: `cm` takes each in its own option (`--user=` or `--group=`, `--users=` or `--groups=`). */
export type MemberKind = 'user' | 'group';

/** A user or group of the server, as `cm acl`, `cm setowner` and a code review's reviewers take it. */
export interface MemberRef {
  name: string;
  kind: MemberKind;
}
