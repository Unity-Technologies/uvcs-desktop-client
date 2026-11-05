import type { IssueTrackerKind, RepositoryTrackerBinding, TrackerConnection } from '../domain/issueTrackers';
import { sameServer } from '../links/linkSegments';
import { TRACKER_GRAMMARS } from './trackerGrammars';
import type { FoundIssueReference } from './trackerGrammar';

/**
 * How a place's comments read issues: its binding's references, and the one issue an address on its server names. The
 * comment readers take it as an option (`MarkdownOptions.issues`), built per binding, so a place with none reads none.
 */
export interface IssueReferenceReader {
  connectionId: string;
  kind: IssueTrackerKind;
  server: string;
  /** Jira keys of the bound projects, GitHub's `owner/repo#12`, and `#12` for a binding of one repository. */
  referencesIn(text: string): FoundIssueReference[];
  /** The canonical key of the issue whose own page `address` is, on the bound server, of a bound project; else null. */
  issueAtAddress(address: string): string | null;
  /** The issue's page in the browser. */
  issueUrl(key: string): string;
}

export function issueReferenceReader(binding: RepositoryTrackerBinding, connection: TrackerConnection): IssueReferenceReader {
  const grammar = TRACKER_GRAMMARS[connection.kind];
  const projects = binding.projects.map((project) => (connection.kind === 'github' ? project.toLowerCase() : project));
  const server = connection.server.toLowerCase();
  return {
    connectionId: connection.id,
    kind: connection.kind,
    server: connection.server,
    referencesIn: grammar.referencesReader(projects),
    issueAtAddress(address) {
      let url: URL;
      try {
        url = new URL(address);
      } catch {
        return null;
      }
      if (`${url.protocol}//${url.host}`.toLowerCase() !== server && `https://${url.host}`.toLowerCase() !== server) return null;
      const reading = grammar.recognize(url);
      if (!reading || !('key' in reading) || reading.shows !== 'issuePage') return null;
      // A Jira key names its project; GitHub's address names any repository on the server, as `owner/repo#12` does.
      return connection.kind !== 'github' && !projects.includes(reading.project) ? null : reading.key;
    },
    issueUrl: (key) => grammar.issueUrl(connection.server, key),
  };
}

/** The binding of `repository`: its name exactly, its server as links match servers (`sameServer`). */
export function bindingOf(bindings: readonly RepositoryTrackerBinding[], repository: string): RepositoryTrackerBinding | undefined {
  return bindings.find((binding) => sameRepository(binding.repository, repository));
}

/** `game@acme@unity` and `game@ACME@unity`, `game@ssl://host:8088` and `game@host:8088`: one repository. */
export function sameRepository(a: string, b: string): boolean {
  const at = (spec: string) => spec.indexOf('@');
  const [nameA, serverA] = at(a) < 0 ? [a, ''] : [a.slice(0, at(a)), a.slice(at(a) + 1)];
  const [nameB, serverB] = at(b) < 0 ? [b, ''] : [b.slice(0, at(b)), b.slice(at(b) + 1)];
  return nameA === nameB && sameServer(serverA, serverB);
}
