import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { foundFileKey, type UnityAssetsAnswer, type UnityAssetsRequest } from '@shared/domain/unityAssets';
import { api } from '../../../../../api/client';
import { IMMUTABLE_QUERY } from '../../../../../app/queryClient';
import { queryKeys } from '../../../../../api/queryKeys';
import { findStaleTime, materialFiles, uniqueFiles, uniqueRequests } from './assetAnswers';
import { readUnityMaterial, type UnityMaterial } from './unityMaterial';

/** Each request's answer (`api.unityAssets.find`), undefined while it's being found, null for none or a failure. */
export function useUnityAssets(workspacePath: string, requests: (UnityAssetsRequest | null)[]): (UnityAssetsAnswer | null | undefined)[] {
  // Both versions of a model at one path ask the same: one query (TanStack warns of the same key twice).
  const unique = useMemo(() => uniqueRequests(requests), [requests]);
  const answers = useQueries({
    queries: unique.requests.map((request) => ({
      queryKey: queryKeys.inWorkspace(workspacePath, 'unityAssets', request),
      queryFn: () => api.unityAssets.find(workspacePath, request),
      staleTime: (query: { state: { data?: UnityAssetsAnswer } }) => findStaleTime(request.point, query.state.data),
    })),
    combine: answersOf,
  });
  return useMemo(() => unique.indices.map((index) => (index === -1 ? null : answers[index])), [unique, answers]);
}

/** The `.mat` files each side's first answer found, read and parsed by GUID; undefined while being read. */
export function useUnityMaterials(
  workspacePath: string,
  answers: (UnityAssetsAnswer | null | undefined)[],
  requests: (UnityAssetsRequest | null)[],
): (Map<string, UnityMaterial | null> | undefined)[] {
  const files = uniqueFiles(materialFiles(answers, requests).flat().flatMap(({ file }) => (file ? [file] : [])), foundFileKey);
  const reads = useQueries({
    queries: files.map((file) => ({
      // Keyed by the version of the file found: a disk file written again is found anew, with its new time.
      queryKey: queryKeys.inWorkspace(workspacePath, 'unityAsset', foundFileKey(file)),
      queryFn: () => api.unityAssets.read(workspacePath, file),
      staleTime: Number.POSITIVE_INFINITY,
      meta: IMMUTABLE_QUERY,
    })),
    combine: settledDataOf,
  });
  return useMemo(() => {
    const found = materialFiles(answers, requests);
    const read = uniqueFiles(found.flat().flatMap(({ file }) => (file ? [file] : [])), foundFileKey);
    const byKey = new Map(read.map((file, i) => [foundFileKey(file), reads[i]]));
    return found.map((side, i) => {
      if (answers[i] === undefined || side.some(({ file }) => file && byKey.get(foundFileKey(file)) === undefined)) return requests[i] ? undefined : new Map();
      return new Map(side.map(({ guid, file }) => [guid, file ? materialOf(byKey.get(foundFileKey(file)) ?? null) : null]));
    });
  }, [reads, answers, requests]);
}

function materialOf(bytes: Uint8Array | null): UnityMaterial | null {
  return bytes ? readUnityMaterial(new TextDecoder().decode(bytes)) : null;
}

/** The reads' bytes, undefined while pending, null for a file that isn't there or a read that failed. */
function settledDataOf(results: { isPending: boolean; isError: boolean; data?: Uint8Array | null }[]): (Uint8Array | null | undefined)[] {
  return results.map((result) => (result.isPending && !result.isError ? undefined : (result.data ?? null)));
}

/** The answers, undefined while being found, null for one that failed. */
function answersOf(results: { isError: boolean; data?: UnityAssetsAnswer | null }[]): (UnityAssetsAnswer | null | undefined)[] {
  return results.map((result) => (result.isError ? null : result.data));
}
