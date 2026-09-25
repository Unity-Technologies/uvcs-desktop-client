export interface RepositorySummary {
  id: string;
  name: string;
  server: string;
  owner: string;
  /** `name@server`, ready to use as a repository spec. */
  spec: string;
}

/** A server the client has credentials for, from `cm profile list`. */
export interface ServerProfile {
  server: string;
  user: string;
  workingMode: string;
}
