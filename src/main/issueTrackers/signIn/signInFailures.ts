import type { SignInFailure } from '@shared/domain/issueTrackers';
import { NotThisTrackerError } from '../providers/IssueTrackerProvider';
import { TrackerError } from '../TrackerError';

/**
 * What a failed sign-in tells the user (`connectFailureWords` words it): a refused token, a server that isn't the
 * tracker, one out of reach, a rate limit. `project`: the failure came proving that project, so no access names it.
 */
export function signInFailureOf(error: unknown, server: string, project?: string): SignInFailure {
  if (error instanceof NotThisTrackerError) return { reason: 'notGitHubEnterprise', server };
  if (!(error instanceof TrackerError)) return { reason: 'unexpected', message: error instanceof Error ? error.message : String(error) };
  switch (error.reason) {
    case 'signInRefused':
      return error.toLogin ? { reason: 'sentToLogin', server } : { reason: 'tokenRefused' };
    case 'noAccess':
      return project ? { reason: 'projectUnreadable', project } : { reason: 'tokenRefused' };
    case 'unreachable':
      return { reason: 'unreachable', server };
    case 'rateLimited':
      return { reason: 'rateLimited' };
    case 'unexpected':
      return { reason: 'unexpected', message: error.message };
  }
}
