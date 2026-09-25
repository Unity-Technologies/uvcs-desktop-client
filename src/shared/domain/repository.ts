export interface RepositorySummary {
  id: string;
  name: string;
  server: string;
  /** `name@server`, ready to use as a repository spec. */
  spec: string;
}

export interface ServerProfile {
  server: string;
  user: string;
  workingMode: string;
}
