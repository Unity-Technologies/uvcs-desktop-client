#!/usr/bin/env bash
# Creates a local repository with a realistic branch topology to try the Branch Explorer.
# Usage: scripts/sandboxes/branch-explorer.sh [repo-name] [workspace-path]
set -euo pipefail

REPO="${1:-sandbox-graph}@local"
WK="${2:-/tmp/uvcs-graph}"

cm mkrep "$REPO"
mkdir -p "$WK"
cd "$WK"
cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null

commit() { # commit <file> <comment>
  mkdir -p "$(dirname "$1")"
  echo "$2 $RANDOM" >> "$1"
  cm add --coparent "$1" >/dev/null 2>&1 || true
  cm ci --all --private -c "$2" >/dev/null
}
branch() { # branch <full-name> <comment>
  cm br create "$1" -c "$2" >/dev/null
  cm switch "br:$1" >/dev/null
}
merge() { # merge <source-spec> <comment> [extra flags]
  cm merge "$1" --merge --keepsource "${@:3}" >/dev/null
  cm ci --all -c "$2" >/dev/null
}

commit readme.md "Initial commit"
commit src/app.ts "Add app skeleton"
commit src/config.ts "Add configuration"
cm label create lb:v0.1 -c "First preview" >/dev/null

branch /main/login "Login screen"
commit src/login.ts "Login form"
commit src/login.ts "Validate credentials"

cm switch br:/main >/dev/null
commit docs/guide.md "Write the user guide"

branch /main/search "Search feature"
commit src/search.ts "Search index"
branch /main/search/fuzzy "Fuzzy matching"
commit src/fuzzy.ts "Levenshtein distance"
commit src/fuzzy.ts "Tune thresholds"

cm switch br:/main/login >/dev/null
commit src/login.ts "Remember me option"

cm switch br:/main >/dev/null
merge br:/main/login "Merge login"
cm label create lb:v0.2 -c "Login release" >/dev/null
commit src/app.ts "Polish startup"

cm switch br:/main/search >/dev/null
merge br:/main/search/fuzzy "Merge fuzzy matching into search"
commit src/search.ts "Rank results"

branch /main/search/hotfix "Hotfix for search"
commit src/config.ts "Fix crash on empty query"
HOTFIX_CS=$(cm find changeset "where branch = '/main/search/hotfix'" --format={changesetid} --nototal | tail -1)

cm switch br:/main >/dev/null
cm merge "cs:$HOTFIX_CS" --merge --cherrypicking --keepsource >/dev/null
cm ci --all -c "Cherry pick search crash fix" >/dev/null
commit src/config.ts "Feature flags"

branch /main/telemetry "Telemetry"
commit src/telemetry.ts "Event collection"

cm switch br:/main/search >/dev/null
merge br:/main/telemetry "Bring telemetry into search"
commit src/search.ts "Search analytics"

cm switch br:/main >/dev/null
merge br:/main/search "Merge search"
commit readme.md "Update readme"
cm label create lb:v1.0 -c "1.0 release" >/dev/null
commit src/app.ts "Start 1.1 work"

branch /main/experiment "Abandoned experiment"
commit src/experiment.ts "Try a new renderer"

cm switch br:/main >/dev/null
for n in 1 2 3 4; do commit src/app.ts "Small improvement $n"; done
echo "Created $REPO at $WK"
