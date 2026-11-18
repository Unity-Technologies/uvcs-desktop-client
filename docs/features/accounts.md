# Accounts

How the app tells the user's accounts apart, and where it shows them. Signing in stays with the official client and
the command line for now: the app reads what `cm` already keeps, and never writes it, but for removing a profile.

## Accounts

`cm` keeps one profile per server (`cm profile list`: a name, a server, a user and how it signs in). The app shows
accounts, as people think of them, made of those profiles (`userAccountsOf`, `main/cm/userAccounts.ts`;
`UserAccount` in `shared/domain/account.ts`):

- **A Unity account**: every cloud profile of one user, whatever the case of the email (`acme@unity`, `acme@cloud`),
  its organizations. A `*@cloud` profile, which `cm` signs in to every cloud organization with when the organization
  has no profile of its own, belongs to its user's account too, and makes one even with no organization listed.
- **A server's account**: a server's profile, its own account. The same user on Unity Cloud and on a server is two
  accounts.
- **This computer** (`local`) belongs to no account: it needs no sign-in, and Home always lists it.

Unity accounts come first, by user, then servers' by server. An account's id (`cloud:<user in lower case>`,
`server:<server>`) stays the same from one read to the next, so a choice made by it (the account Home shows) holds.

The accounts come from the one profiles read the servers and the setup check share (`ProfileList`, docs/ARCHITECTURE.md
"Windows"): `api.accounts.accounts()` runs no command of its own, and the home screen asks for it with the servers as
it starts (`readFirstScreen`, `prefetchStartupQueries`), so both take one `cm profile list`. In the renderer they are
`userAccountsQuery`, kept under the `profiles` key: what reads the servers again (removing a profile) reads them too.

## Home

The home sidebar lists the organizations of one Unity account at a time, under a switcher at its top
(`AccountSwitcher`): the account's avatar and email, and a menu holding each Unity account (the one shown checked)
when there are two or more, then "Manage accounts…" (Settings › Accounts). Folded, the switcher is the avatar alone.
Without a Unity account there is no switcher. The palette offers "Switch account to …" for each Unity account when
there are two or more (`accountSwitchCommands`), on the home screen only.

- **Which account shows** (`homeAccountOf`), the first that names one: the account holding the repositories on screen
  (a link may open another account's organization), the one picked in this window since it came to the home screen,
  the account of the workspace the window left (from the workspace's info the window read while it showed it, never
  read again for this), the one last picked in any window (`AppSettings.homeAccount`), else the first.
- **What it lists** (`homeServersOf`): this computer, the shown account's organizations, and every server's account,
  a server's entry showing its user (`serverEntryDetail`), as a server is an account of its own.
- **Picking an account only shows it** (`showHomeAccount`): it changes nothing in `cm`, and is remembered in the app's
  own settings, never `cm`'s. Repositories of the account left give way to the welcome (`sectionAfterSwitch`). The
  official client rewrote the server's profile on every pick; with one profile per server, two accounts in one
  organization overwrote each other.

## Settings

Settings › Accounts has one row per account (`accountRowsOf`): its user, then "Unity · 3 organizations" or the server
and how it signs in; the account signing in to the window's place first, marked "This workspace". A Unity account's
row opens to its organizations, then its `*@cloud` profile ("Any cloud organization"), each removed apart with
`cm profile delete`; a server's row removes its one profile itself. Removing a whole account at once isn't offered:
`cm profile delete` leaves the account's sign-in behind, so a loop of them signs nothing out. This computer's profile
isn't listed, as it belongs to no account. The account menu's count is the rows'.

## Known limit

Organizations come from the profiles, so an organization the user reaches only through their `*@cloud` profile, with
no profile of its own, isn't listed under their account; nor does an organization show its display name. Both need
`cm` to list an account's organizations, which it can't today.
