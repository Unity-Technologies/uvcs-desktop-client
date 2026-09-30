# Locks

The Locks view lists the repository's exclusive checkouts (`cm lock list`) and releases them (`cm lock unlock`);
how its rows, filters and refreshes work is in ARCHITECTURE.md (Item rows, Filters, Server budget). This doc holds
what the code can't show.

## Lock rules

Lock rules decide which files lock when someone checks them out (file patterns such as `*.psd` or `/Art/`), and the
branches where they don't. They belong to the server (an on-premises server's `lock.conf`, a cloud organization's
settings) and only its administrators edit them.

- **No `cm` command reads or writes them**: `cm lock` has only `list`, `unlock` and `create`. The official client
  doesn't edit them either: its Locks view's "Configure lock rules" opens the server's page for them
  (`OpenConfigureLockRulesPage`), and so does this app.
- "Lock rules" in the Locks view's header, and "Configure lock rules" in the palette while the view shows, open that
  page in the browser (`openLockRules`, `useLockRulesCommand`). `lockRulesUrl` (`app/account/serverAccount.ts`)
  builds it from the workspace's server, which the window already read, so it costs no `cm` command:
  - a cloud organization: its `…/plastic-scm/organizations/<organization>/lock-rules` page in the Unity Cloud
    dashboard, under its genesis id when the server or its account names one (`dashboardOrganizations`);
  - an on-premises server: its web admin, `http://<host>:7178/configuration/lock-rules` (the port every web admin
    listens on, as the official client assumes; the protocol and port of the server's address dropped);
  - the local server (`local`): none, and the button doesn't show.
- The page's tooltip says where it opens (`lockRulesPage`), as the app never leaves for the browser without saying so.

Rejected: a lock rules dialog of the app's own. The rules are reachable only through the server's web API (the web
admin's `LockRulesControllerV2`, the cloud's `LockRulesController`), which takes its own sign-in rather than `cm`'s:
the app would have to hold credentials and talk to the server outside `CmClient`. The official client's "add a lock
rule and check out" (from a file that isn't lockable) goes through the server's API too, and isn't offered.
