/**
 * A connection profile from `cm profile list`: who `cm` signs in as on a server.
 * `cm` keeps one profile per server; `*@cloud` applies to every cloud organization without its own.
 */
export interface Account {
  /** Identifies the profile for `cm profile delete`, e.g. `1375488836673@cloud` or `acme@cloud`. */
  name: string;
  /** The server as `cm` shows it, e.g. `acme@unity`, `acme@cloud` or `ssl://host:8088`. */
  server: string;
  user: string;
  /** How it authenticates: `SSOWorkingMode`, `LDAPWorkingMode`, `UPWorkingMode`… */
  workingMode: string;
}
