import type { MergeRequest } from './merge';

/**
 * Whether the merge can ignore merge tracking (`ignoreMergeTracking`): `cm merge --forced` takes it only with a cherry
 * pick or a subtractive merge, of one changeset or a range, and refuses it on a regular merge.
 */
export function offersIgnoreMergeTracking(request: MergeRequest): boolean {
  return request.kind === 'cherryPick' || request.kind === 'subtractive';
}

/**
 * Whether the user can choose the merge's common ancestor (`ancestorSpec`): only a regular merge has one to choose. A
 * cherry pick, a subtractive merge and a range take theirs from the changesets they name, and a shelve's is its base.
 */
export function offersCommonAncestor(request: MergeRequest): boolean {
  return request.kind === 'merge' && !request.intervalOriginSpec && !request.sourceSpec.startsWith('sh:');
}
