import type { BoundProjectsAnswer, IssueTrackerKind, ProjectAccess, TrackerConnection } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { hostOf, trackerKindName } from './connectFlow';

/** How a connection stands, as its status pill says it: fine, needing the user, or failing. */
export type StatusTone = 'positive' | 'caution' | 'danger';

export interface TrackerStatus {
  tone: StatusTone;
  label: string;
}

/** Whether a connection's credential needs signing in again: refused by the tracker, or gone from this computer. */
export function needsSignIn(connection: Pick<TrackerConnection, 'credential'>): boolean {
  return connection.credential === 'refused' || connection.credential === 'missing';
}

/**
 * The connection's status (docs/features/issue-trackers.md, "Connecting"): "Connected"; "Needs sign-in" when its
 * credential stopped working (or the projects' read was refused); "Can't reach Jira" when no project answered.
 */
export function trackerStatus(connection: Pick<TrackerConnection, 'credential' | 'kind'>, projects: BoundProjectsAnswer | undefined): TrackerStatus {
  if (needsSignIn(connection) || (projects?.kind === 'failed' && projects.reason === 'signInRefused')) return { tone: 'caution', label: 'Needs sign-in' };
  if (projects?.kind === 'failed' && projects.reason === 'unreachable') return { tone: 'danger', label: `Can't reach ${TRACKER_GRAMMARS[connection.kind].name}` };
  return { tone: 'positive', label: 'Connected' };
}

/** What the card says when the tracker can't be reached: where, and what that means for the comments. */
export function unreachableWords(connection: Pick<TrackerConnection, 'kind' | 'server'>): { title: string; detail: string } {
  return { title: `Can't reach ${TRACKER_GRAMMARS[connection.kind].name} at ${hostOf(connection.server)}`, detail: 'Issues show as plain links until it answers.' };
}

/** The card's header: the tracker by name, its server's kind and host. */
export function trackerHeader(connection: Pick<TrackerConnection, 'kind' | 'server'>): { name: string; kindName: string; host: string } {
  return { name: TRACKER_GRAMMARS[connection.kind].name, kindName: trackerKindName(connection.kind, connection.server), host: hostOf(connection.server) };
}

/** Who is signed in: the name, and the email or login under it when it says more. */
export function accountLines(account: TrackerConnection['account']): { name: string; detail?: string } {
  const detail = account.email ?? (account.id !== account.name && !/^[0-9a-f:-]{12,}$/i.test(account.id) ? account.id : undefined);
  return { name: account.name, ...(detail && { detail }) };
}

/** A bound project's row: its key or repository, its name when it says more, its counts, and how to remove it. */
export interface ProjectRow {
  project: string;
  label: string;
  name?: string;
  counts?: string;
  /** Only when another project stays: the last one goes with Disconnect. */
  removeLabel?: string;
}

export function projectRows(projects: readonly string[], answer: BoundProjectsAnswer | undefined): ProjectRow[] {
  const read = new Map(answer?.kind === 'read' ? answer.projects.flatMap((bound) => (bound.access ? [[bound.project, bound.access] as const] : [])) : []);
  return projects.map((project) => {
    const access = read.get(project);
    const counts = access && countWords(access);
    return {
      project,
      label: project,
      ...(access && access.name.toLowerCase() !== project.toLowerCase() && { name: access.name }),
      ...(counts && { counts }),
      ...(projects.length > 1 && { removeLabel: `Remove ${project}` }),
    };
  });
}

/** "214 open · 6 assigned to you", or none when the tracker didn't count. */
function countWords(access: ProjectAccess): string | undefined {
  if (access.openIssues === undefined) return undefined;
  return access.assignedToYou === undefined ? `${access.openIssues} open` : `${access.openIssues} open · ${access.assignedToYou} assigned to you`;
}

/** What the projects are for, with what a reference to them looks like. */
export function projectsExplained(kind: IssueTrackerKind, projects: readonly string[]): string {
  const first = projects[0] ?? (kind === 'github' ? 'owner/repo' : 'PROJ');
  if (kind !== 'github') return `Keys like ${first}-123 in this repository's comments show as chips with the issue's title and status.`;
  const references = projects.length === 1 ? '#123 and links to its issues' : `${first}#123 and links to their issues`;
  return `${references} in this repository's comments show as chips with the issue's title and status.`;
}

/** The project noun a tracker's links name: a Jira project, a GitHub repository. */
export function projectNoun(kind: IssueTrackerKind): string {
  return kind === 'github' ? 'repository' : 'project';
}

/** The steps of Connect, and where the user is: the tracker (picked before it opens), a link to one of its issues, then signing in. */
export type ConnectStepState = 'done' | 'current' | 'next';

export type ConnectStage = 'link' | 'signIn';

/**
 * The first step names the tracker picked, done ("Jira ✓ · Link · Sign in"); with a sign-in already there
 * (`signedIn`), the last one only connects ("Connect").
 */
export function connectSteps(stage: ConnectStage, trackerName: string, { signedIn = false } = {}): { label: string; state: ConnectStepState }[] {
  const later: { stage: ConnectStage; label: string }[] = [
    { stage: 'link', label: 'Link' },
    { stage: 'signIn', label: signedIn ? 'Connect' : 'Sign in' },
  ];
  const at = later.findIndex((step) => step.stage === stage);
  return [{ label: trackerName, state: 'done' }, ...later.map((step, index): { label: string; state: ConnectStepState } => ({ label: step.label, state: index < at ? 'done' : index === at ? 'current' : 'next' }))];
}

/** Which of the token step's buttons leads: "Create a token" until one is in the field, then "Sign in". */
export function tokenStepLead(token: string): 'createToken' | 'signIn' {
  return token.trim() === '' ? 'createToken' : 'signIn';
}

/** What Disconnect asks before it unbinds the repository: what changes, and that the sign-in stays. */
export function disconnectQuestion(name: string): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Disconnect ${name}?`,
    message: `Issues in this repository's comments go back to plain text. Your ${name} sign-in stays for other repositories.`,
    confirmLabel: 'Disconnect',
  };
}
