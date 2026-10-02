#!/usr/bin/env bash
# Builds a repository with permissions of its own at every level, to see the Permissions dialog against: entries on the
# repository, a branch with a list of its own (with an override), a branch that shares the repository's, a label and
# an attribute with entries, a secured path, and a group of branches of another path.
# It never changes the server's own permissions: only this repository's objects'.
# Usage: scripts/sandboxes/permissions.sh   → repo permissions-demo@local, workspace /tmp/uvcs-permissions-demo
set -euo pipefail
REPO=permissions-demo@local
WK=/tmp/uvcs-permissions-demo
ME=$(cm whoami)

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create permissions-demo "$WK" "$REPO" >/dev/null
cd "$WK"

mkdir -p Assets/Art Assets/Scripts Docs
printf 'class Player {}\n' > Assets/Scripts/Player.cs
printf 'binary\n' > Assets/Art/Hero.psd
printf '# Docs\n' > Docs/README.md
cm add -R Assets Docs >/dev/null
cm ci -c "First version" >/dev/null
cm br mk /main/task-1 >/dev/null
cm br mk /main/release-2.0 >/dev/null
cm br mk /main/shares-the-repository >/dev/null
cm label mk v1.0 >/dev/null
cm attribute create status >/dev/null

acl() { cm acl "$@" >/dev/null; }
# The repository: everyone may read, the owner may delete, you may not delete labels.
acl --group=all -allowed=+view,+read,+ci,+add,+change,+move,+rm,+mkchildbranch,+mergefrom rep:"$REPO"
acl --user=OWNER -allowed=+rmchangeset,+rmlabel,+rmattr rep:"$REPO"
acl --user="$ME" -denied=+rmlabel rep:"$REPO"
# A release branch nobody checks in to, but you, past the deny.
acl --group=all -denied=+ci br:/main/release-2.0@"$REPO"
acl --user="$ME" -allowed=+ci -overridedenied=+ci br:/main/release-2.0@"$REPO"
# A task branch where everyone's check-ins are allowed explicitly.
acl --group=all -allowed=+ci,+rename br:/main/task-1@"$REPO"
acl --group=all -denied=+rmlabel lb:v1.0@"$REPO"
acl --group=all -denied=+rmattr att:status@"$REPO"
# Nobody deletes art, on any branch.
acl --group=all -denied=+rm path:/Assets/Art@"$REPO"
# Docs only change on the release branch (a group of branches tagged "release"). cm may fail printing the branches
# when the repository's server isn't its default one, after it created the group.
cm acl --group=all -denied=+change path:/Docs#release@"$REPO" --branches=/main/release-2.0 >/dev/null 2>&1 || true

echo "Repository $REPO and workspace $WK ready."
