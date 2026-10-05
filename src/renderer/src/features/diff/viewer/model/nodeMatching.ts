// Which node of one version is which of the other, so a change reads as Unity will take it. Unity binds by name and
// path (prefab overrides, `transform.Find`, animation curves, the avatar's bones), so a node keeps its identity under
// its matched parent by name; what is left is paired by likeness under the same parent (renamed), then by name
// anywhere (moved to another parent), and only then counts as removed or added. Children of a renamed or moved node
// are matched under it, so renaming `Arm_L` reads as one rename, not as every bone below it removed and added.

import type { ModelNodeKind } from './parsedModel';
import type { ModelSummary, SummaryNode } from './modelSummary';

export interface NodeMatching {
  /** For each node of the version before, its node in the one after; -1 when it was removed. */
  afterOf: number[];
  /** For each node of the version after, its node in the one before; -1 when it was added. */
  beforeOf: number[];
  /** Pairs [before, after] matched by likeness under the same parent, their names different. */
  renamed: [number, number][];
  /** Pairs [before, after] matched by name under another parent. */
  moved: [number, number][];
}

/** How alike two transforms must be to count as the same: a re-export rounds them. */
const TRANSFORM_EPSILON = 1e-4;

export function matchNodes(before: ModelSummary, after: ModelSummary): NodeMatching {
  const afterOf = before.nodes.map(() => -1);
  const beforeOf = after.nodes.map(() => -1);
  const renamed: [number, number][] = [];
  const moved: [number, number][] = [];
  const childrenBefore = childrenOf(before.nodes);
  const childrenAfter = childrenOf(after.nodes);
  const pair = (b: number, a: number): void => {
    afterOf[b] = a;
    beforeOf[a] = b;
  };

  const matchChildren = (b: number, a: number): void => {
    const left = (childrenBefore[b] ?? []).filter((child) => afterOf[child] === -1);
    const right = (childrenAfter[a] ?? []).filter((child) => beforeOf[child] === -1);
    const matched: [number, number][] = [];
    for (const child of left) {
      const same = right.find((candidate) => beforeOf[candidate] === -1 && after.nodes[candidate]!.name === before.nodes[child]!.name);
      if (same === undefined) continue;
      pair(child, same);
      matched.push([child, same]);
    }
    for (const [child, candidate] of likelyRenames(left.filter((c) => afterOf[c] === -1), right.filter((c) => beforeOf[c] === -1), before, after)) {
      pair(child, candidate);
      renamed.push([child, candidate]);
      matched.push([child, candidate]);
    }
    for (const [child, candidate] of matched) matchChildren(child, candidate);
  };

  if (before.nodes.length > 0 && after.nodes.length > 0) {
    pair(0, 0);
    matchChildren(0, 0);
  }
  // Moves: what is left, paired by name and kind when that name is the only one of its kind left on each side.
  for (let found = true; found; ) {
    found = false;
    for (const [b, a] of uniqueByName(before.nodes, afterOf, after.nodes, beforeOf)) {
      pair(b, a);
      moved.push([b, a]);
      matchChildren(b, a);
      found = true;
    }
  }
  return { afterOf, beforeOf, renamed, moved };
}

function childrenOf(nodes: SummaryNode[]): number[][] {
  const children: number[][] = nodes.map(() => []);
  nodes.forEach((node, i) => {
    if (node.parent >= 0) children[node.parent]!.push(i);
  });
  return children;
}

/**
 * Leftover siblings paired as renames, the likeliest first: the same mesh, the same transform, the same children's
 * names. A pair that ties with another pair of either node tells nothing (two boxes alike as a third) and stays
 * apart. A single leftover of a kind on each side is a rename even with nothing else alike: an artist renamed it.
 */
function likelyRenames(left: number[], right: number[], before: ModelSummary, after: ModelSummary): [number, number][] {
  const candidates: { b: number; a: number; score: number }[] = [];
  for (const b of left) {
    for (const a of right) {
      if (!compatibleKinds(before.nodes[b]!.kind, after.nodes[a]!.kind)) continue;
      const score = likeness(b, a, before, after);
      const onlyOfKind = left.filter((c) => compatibleKinds(before.nodes[c]!.kind, before.nodes[b]!.kind)).length === 1 && right.filter((c) => compatibleKinds(after.nodes[c]!.kind, after.nodes[a]!.kind)).length === 1;
      if (score > 0 || onlyOfKind) candidates.push({ b, a, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  const pairs: [number, number][] = [];
  const taken = new Set<number>();
  for (const { b, a, score } of candidates) {
    if (taken.has(b) || taken.has(-1 - a)) continue;
    const tied = candidates.some((other) => other.score === score && (other.b === b) !== (other.a === a) && !taken.has(other.b) && !taken.has(-1 - other.a));
    if (tied) continue;
    taken.add(b).add(-1 - a);
    pairs.push([b, a]);
  }
  return pairs;
}

function likeness(b: number, a: number, before: ModelSummary, after: ModelSummary): number {
  const nodeBefore = before.nodes[b]!;
  const nodeAfter = after.nodes[a]!;
  let score = 0;
  const meshBefore = nodeBefore.mesh === null ? null : before.meshes[nodeBefore.mesh]!;
  const meshAfter = nodeAfter.mesh === null ? null : after.meshes[nodeAfter.mesh]!;
  if (meshBefore && meshAfter) {
    if (meshBefore.fingerprints.positions === meshAfter.fingerprints.positions) score += 3;
    else if (meshBefore.triangles === meshAfter.triangles) score += 1;
  }
  if (sameTransform(nodeBefore, nodeAfter)) score += 2;
  const childNames = (summary: ModelSummary, index: number): string =>
    summary.nodes
      .filter((node) => node.parent === index)
      .map((node) => node.name)
      .sort()
      .join('\n');
  const names = childNames(before, b);
  if (names !== '' && names === childNames(after, a)) score += 2;
  return score;
}

function sameTransform(a: SummaryNode, b: SummaryNode): boolean {
  const close = (x: number[], y: number[]): boolean => x.every((value, i) => Math.abs(value - y[i]!) <= TRANSFORM_EPSILON * Math.max(1, Math.abs(value)));
  return close(a.position, b.position) && close(a.rotation, b.rotation) && close(a.scale, b.scale);
}

/** A mesh that became skinned, or an empty that became a bone, is still the same GameObject. */
function compatibleKinds(a: ModelNodeKind, b: ModelNodeKind): boolean {
  const family = (kind: ModelNodeKind): string => (kind === 'skinnedMesh' ? 'mesh' : kind === 'bone' ? 'group' : kind);
  return family(a) === family(b);
}

function uniqueByName(beforeNodes: SummaryNode[], afterOf: number[], afterNodes: SummaryNode[], beforeOf: number[]): [number, number][] {
  const keyOf = (node: SummaryNode): string => `${node.name}\n${compatibleKinds(node.kind, 'mesh') ? 'mesh' : compatibleKinds(node.kind, 'group') ? 'group' : node.kind}`;
  const left = new Map<string, number[]>();
  const right = new Map<string, number[]>();
  beforeNodes.forEach((node, i) => afterOf[i] === -1 && left.set(keyOf(node), [...(left.get(keyOf(node)) ?? []), i]));
  afterNodes.forEach((node, i) => beforeOf[i] === -1 && right.set(keyOf(node), [...(right.get(keyOf(node)) ?? []), i]));
  const pairs: [number, number][] = [];
  for (const [key, olds] of left) {
    const news = right.get(key);
    if (olds.length === 1 && news?.length === 1) pairs.push([olds[0]!, news[0]!]);
  }
  return pairs;
}
