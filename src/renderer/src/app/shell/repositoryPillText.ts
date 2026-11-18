import { describeServer, splitRepositorySpec } from '../../lib/servers';

/**
 * What the top bar's repository pill (`RepositoryPill`) shows of a repository explored without a workspace: its name,
 * where it lives as the home screen names servers (`describeServer`), and the tooltip that says both.
 */
export function repositoryPillText(repository: string): { name: string; where: string; tip: string } {
  const { name, server } = splitRepositorySpec(repository);
  const where = describeServer(server).label;
  return { name, where, tip: `${name} · ${where}` };
}
