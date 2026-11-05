import type { IssueTrackerKind, RepositoryTrackerBinding, TrackerConnection } from '../domain/issueTrackers';
import { sameServer } from '../links/linkSegments';
import { githubKeyParts } from './grammars/github';
import { JIRA_KEY } from './grammars/jiraKeys';
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
  /** The bound projects: Jira keys, GitHub's `owner/repo` in lower case. */
  projects: readonly string[];
  /** How a picked issue is written so this reader reads it back: `#VCS-12`, `#12` for the one repository bound. */
  referenceText(key: string): string;
  /**
   * The issue a text typed after `#` names, read by key rather than searched: a bound project's key (`vcs-12` too), or
   * a number when one project is bound; else null.
   */
  keyTyped(typed: string): string | null;
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
    projects,
    referenceText(key) {
      // Its `#` kept, as typed (`@` and `cs:` stay too); Jira's reader reads `#VCS-12` as the key (`jiraReferencesReader`).
      if (connection.kind !== 'github') return `#${key}`;
      const parts = githubKeyParts(key);
      // `#12` reads as the one repository bound's (`githubGrammar.referencesReader`), any other as `owner/repo#12`.
      return parts && projects.length === 1 && `${parts.owner}/${parts.name}` === projects[0] ? `#${parts.number}` : key;
    },
    keyTyped(typed) {
      const number = /^[1-9]\d*$/.test(typed) ? typed : null;
      if (connection.kind === 'github') return number && projects.length === 1 ? `${projects[0]}#${number}` : null;
      if (number) return projects.length === 1 ? `${projects[0]}-${number}` : null;
      const key = JIRA_KEY.exec(typed.toUpperCase());
      return key && projects.includes(key[1]!) ? key[0] : null;
    },
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
