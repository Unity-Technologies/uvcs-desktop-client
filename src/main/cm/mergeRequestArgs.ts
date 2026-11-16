import type { CreatedMergeRequest, CreateMergeRequestRequest, MergeRequestState } from '@shared/domain/codeReview';
import type { CmPlace } from './cmPlace';
import { reviewersOptions } from './codeReviewArgs';

/*
 * `cm mergerequest` only for what a merge request has and a code review hasn't: creating one, its state and its
 * destination. Every other write on one (reviewers, statuses, comments, title, description, delete) is `cm codereview`'s, which takes a
 * merge request's id unchanged (docs/features/merge-requests.md). Both edits print nothing.
 */

/** `cm mergerequest edit --mergerequeststatus`: the state by its English name, as `cm` takes it whatever its language. */
export function mergeRequestStateArgs(reviewId: number, state: MergeRequestState, at: CmPlace): string[] {
  return ['mergerequest', 'edit', String(reviewId), `--mergerequeststatus=${state}`, ...at.repositoryOption];
}

/** `cm mergerequest edit --destination`: the branch it merges into from now on. */
export function mergeRequestDestinationArgs(reviewId: number, branch: string, at: CmPlace): string[] {
  return ['mergerequest', 'edit', String(reviewId), `--destination=${at.spec(`br:${branch}`)}`, ...at.repositoryOption];
}

/**
 * `cm mergerequest create`: the source and destination by branch spec, a draft by its state's English name, the
 * reviewers in the same command, and the description from a file (`descriptionFile`), since a `cm shell` line holds
 * no line breaks. It prints the new id.
 */
export function createMergeRequestArgs({ source, destination, title, draft, reviewers = [] }: CreateMergeRequestRequest, descriptionFile: string | undefined, at: CmPlace): string[] {
  return [
    'mergerequest',
    'create',
    at.spec(`br:${source}`),
    title,
    `--destination=${at.spec(`br:${destination}`)}`,
    ...(draft ? ['--mergerequeststatus=Draft'] : []),
    ...reviewersOptions(reviewers),
    ...(descriptionFile ? [`--descriptionfile=${descriptionFile}`] : []),
    '--format={id}',
    ...at.repositoryOption,
  ];
}

/**
 * The request `cm mergerequest create` made, from what it printed: the id, alone on its line. `cm` makes the request,
 * then writes its description; when that fails it says so, still prints the id and exits 1 (`failed`): the request
 * exists, without its description. None when it printed no id: nothing was made.
 */
export function createdMergeRequestOf(output: string, failed: boolean): CreatedMergeRequest | undefined {
  const idLine = output.split(/\r?\n/).map((line) => line.trim()).find((line) => /^\d+$/.test(line));
  return idLine === undefined ? undefined : { id: Number(idLine), descriptionSaved: !failed };
}
