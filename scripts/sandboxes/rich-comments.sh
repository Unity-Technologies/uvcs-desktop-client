#!/usr/bin/env bash
# Builds a repository whose comments use everything a rich comment can hold (docs/features/rich-comments.md): Markdown
# (headings, bold, a task list, a table, code in C# and in a language no highlighter knows, keys, a quote, a rule), a reference of every kind (changesets, a branch,
# a label, a shelve, a code review, a file at a changeset, an object in another repository and on a server named by its
# host, a uvcs:// link), people (one named in another script), emoji, an image from the web, a bare email address,
# plain multi-line comments that must read as written, and a comment that opens with a list. One-line comments with
# formatting and chips fill the lists.
# Usage: scripts/sandboxes/rich-comments.sh [repo-name [workspace-folder]]   → repo rich-comments@local, workspace /tmp/uvcs-rich-comments
# It deletes and recreates both (and a second repository, <repo-name>-art, for the cross-repository reference), so it
# takes only names: the repositories are always on the local server, the workspace always a folder of /tmp.
set -euo pipefail
NAME=${1:-rich-comments}
FOLDER=${2:-uvcs-rich-comments}
case "$NAME/$FOLDER" in
  */*/* | *@* | *..* | */. | */-* | *[[:space:]]*) echo "Give names only (no server, no path): $NAME $FOLDER" >&2; exit 1 ;;
esac
REPO="$NAME@local"
ART="$NAME-art@local"
WK="/tmp/$FOLDER"
ME=$(cm whoami)
COMMENTS=$(mktemp -d)
trap 'rm -rf "$COMMENTS"' EXIT

for repo in "$REPO" "$ART"; do cm rmrep "$repo" >/dev/null 2>&1 || true; done
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
cm mkrep "$ART" >/dev/null
mkdir -p "$WK"
cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null

# The comment is read from a file: `-c` can't hold its lines.
comment() { printf '%s\n' "$2" > "$COMMENTS/$1"; echo "$COMMENTS/$1"; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }
checkin() { cm ci --all --private -commentsfile="$1" >/dev/null; }
changeset() { cm find "changeset where branch = '$1'" "order by changesetid desc" limit 1 --format={changesetid} --nototal; }

cd "$WK"
w Assets/Scripts/PlayerController.cs "public class PlayerController { float speed = 9f; }"
w Assets/Scripts/SwitchFlow.cs "public class SwitchFlow {}"
w README.md "# Rich comments"
checkin "$(comment initial 'Initial project

Plain comments keep their lines:
this one has three,
written without any Markdown.')"
FIRST=$(changeset /main)

w Assets/Scripts/SwitchFlow.cs "public class SwitchFlow { void Switch() {} }"
checkin "$(comment plain 'Switching keeps pending changes :tada:')"
SWITCH=$(changeset /main)

cm mkbr main/task-2210 -commentsfile="$(comment branch "Switching with changes never loses them

Follows cs:$SWITCH. Owner: @$ME")" >/dev/null
cm switch main/task-2210 >/dev/null
w Assets/Scripts/SwitchFlow.cs "public class SwitchFlow { void Switch() { Shelve(); Update(); Apply(); } }"
checkin "$(comment task "Fix **the crash** when switching with \`pending changes\`, found in cs:$SWITCH

## What changed

- [x] Shelve, undo, switch, bring
- [ ] Put the changes back when the switch fails
- Run \`cm switch\` only once, see serverpath:/Assets/Scripts/SwitchFlow.cs#cs:$SWITCH
- Find it with <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>⌘</kbd><kbd>F</kbd> on a Mac)

| Case | Before | After |
| :-- | :-: | --: |
| Switch with changes | Lost on failure | Put back :white_check_mark: |
| Fixed in | cs:$FIRST | cs:$SWITCH |

\`\`\`csharp
public void Switch(Branch target)
{
    var shelve = Shelve(pending);
    Update(target, retries: 3);
    Apply(shelve);
}
\`\`\`

> Never drop the user into a terminal.

---

Thanks @$ME and @josé.garcía! Same fix in the art repository: cs:1@$NAME-art@local, and on the build server:
cs:7@game@build.acme.com:8087. Questions to ana@acme.com. The dialog: ![the switch dialog](https://raw.githubusercontent.com/github/explore/main/topics/git/git.png)
~~Old approach~~ dropped. Link: uvcs://local/repos/$NAME/changesets/$SWITCH and [the docs](https://docs.unity.com/en-us/unity-version-control)")"
TASK=$(changeset /main/task-2210)

cm label create lb:v1.4.0 "cs:$TASK" -commentsfile="$(comment label "Release with the switch fix from br:/main/task-2210 :rocket:")" >/dev/null

w Assets/Scripts/PlayerController.cs "public class PlayerController { float speed = 12f; }"
SHELVE=$(cm shelveset create --all --summaryformat -commentsfile="$(comment shelve "WIP: faster steering, after cs:$TASK")" | sed -E 's/^sh:([0-9]+).*/\1/')
cm undo --all . >/dev/null 2>&1 || cm undo -r . >/dev/null

REVIEW=$(cm codereview "cs:$TASK" "Review the switch fix in br:/main/task-2210" --format={id})

cm switch main >/dev/null
w README.md "# Rich comments
Merged the switch fix."
checkin "$(comment main "Merge request cr:$REVIEW approved :+1: — ships in lb:v1.4.0, shelve sh:$SHELVE has the next step")"

w docs/notes.md "Release notes"
checkin "$(comment list "- Tidied the README
- Notes for the release
- Nothing else")"

w docs/keys.md "Keys"
checkin "$(comment keys 'Press <kbd>Esc</kbd> to cancel a switch

A language the highlighter doesn'"'"'t know shows plain, and a long line scrolls sideways:

```nosuchlanguage
switch --keep-changes --to /main/task-2210 --then bring --everything --that --was --pending --before --the --switch --started
```')"

# The other repository's first changeset, which the task's comment names.
ARTWK="$WK-art"
cm wk delete "$ARTWK" >/dev/null 2>&1 || true
rm -rf "$ARTWK"
mkdir -p "$ARTWK"
cm wk create "$(basename "$ARTWK")" "$ARTWK" "$ART" >/dev/null
cd "$ARTWK"
w Textures/Ship.txt "ship"
checkin "$(comment art 'Art for the switch dialog')"
cd "$WK"

echo "Built $REPO in $WK (and $ART in $ARTWK): code review $REVIEW, label v1.4.0, shelve $SHELVE"
