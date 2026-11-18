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

/**
 * An account as the user thinks of one, made of the profiles above (`userAccountsOf`): a Unity account, one user's
 * cloud organizations (`acme@unity`, `acme@cloud`), or a user on one server. `cm` keeps the rest.
 */
export interface UserAccount {
  /** Stays the same from one read to the next: `cloud:<user in lower case>` or `server:<server>`. */
  id: string;
  user: string;
  kind: 'cloud' | 'server';
  /** How it signs in, as its first profile says (`SSOWorkingMode`…). */
  workingMode: string;
  /**
   * The organizations of a Unity account, or a server account's one server, as `cm` names them; never a wildcard. A
   * Unity account known only from its `*@cloud` profile has none.
   */
  servers: string[];
  /** Every profile it is made of, `*@cloud` included: what is removed, one by one. */
  profiles: Account[];
}
