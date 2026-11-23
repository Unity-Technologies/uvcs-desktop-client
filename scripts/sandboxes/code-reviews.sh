#!/usr/bin/env bash
# Builds a repository whose code review holds every kind of comment `cm codereview comment` makes: a description, a
# general comment and its reply, change requests on a line (pending, applied by a later changeset through the check-in
# comment, applied by one that changed other files only, applied by hand with `comment apply`, discarded), questions
# (answered and not), a plain comment on a line, a comment on a deleted file, a comment filed under one changeset's
# diff, an edited comment, and comments on a revision a later changeset replaced (the comments on an older revision): on
# lines it left alone, which the Changes tab shows at their line in the newest one, and on a line it edited (an open
# question, the discarded request), outdated; and comments far down a long file (two lines apart, which the diff's
# scrollbar ticks as one) and near its end. The timeline gets a rename and a status change with a comment. Change
# requests suggest changes (a ```suggestion fence, docs/features/code-reviews.md "Suggested changes"): a line replaced,
# a line deleted, a line replaced by several, a line wrapped in a new condition, one in a file with Windows line ends,
# three lines replaced by one (a comment on a range, `--line=A-B`), and one outdated, its line changed since; a question
# holds the same fence, which reads as code. A question on a range of lines goes outdated too, a line of it edited. An
# image holds comments on a point and on an area (`--location=image:…`): open, answered, and one on its earlier
# version, which a later check-in repainted. Two more reviews have
# no comments: one of a changeset, one of a shelve. The workspace ends on the review's branch, where its suggestions
# can be applied.
# Usage: scripts/sandboxes/code-reviews.sh [repo-name [workspace-folder]]   → repo code-reviews@local, workspace /tmp/uvcs-code-reviews
# It deletes and recreates both, so it takes only names: the repository is always on the local server, the workspace
# always a folder of /tmp.
set -euo pipefail
NAME=${1:-code-reviews}
FOLDER=${2:-uvcs-code-reviews}
case "$NAME/$FOLDER" in
  */*/* | *@* | *..* | */. | */-* | *[[:space:]]*) echo "Give names only (no server, no path): $NAME $FOLDER" >&2; exit 1 ;;
esac
REPO="$NAME@local"
WK="/tmp/$FOLDER"
TEXTS=$(mktemp -d)
trap 'rm -rf "$TEXTS"' EXIT

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK"
cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null

# Texts are read from files: `-c` can't hold lines.
text() { printf '%s\n' "$2" > "$TEXTS/$1"; echo "$TEXTS/$1"; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }
checkin() { cm ci --all --private -commentsfile="$1" >/dev/null; }
# A 320×200 PNG banner: a sky, a sun and hills, which each variant paints apart (its sun moved, its hills recolored).
banner() { sleep 1; mkdir -p "$(dirname "$2")"; python3 -c "import sys,zlib,struct
v=int(sys.argv[1]); w,h=320,200; sun=(90+60*v,60); hill=[(60,140,70),(200,120,40),(120,60,160)][v]
def px(x,y):
  if (x-sun[0])**2+(y-sun[1])**2<26**2: return (250,200,60)
  if y>150-40*((x/w-0.5)**2*4): return hill
  return (90+y//4,150+y//4,230)
raw=b''.join(b'\\0'+b''.join(bytes(px(x,y)) for x in range(w)) for y in range(h))
chunk=lambda t,d: struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
sys.stdout.buffer.write(b'\\x89PNG\\r\\n\\x1a\\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))" "$1" > "$2"; }
changeset() { cm find "changeset where branch = '$1'" "order by changesetid desc" limit 1 --format={changesetid} --nototal; }
on_review() { cm cr comment add "$REVIEW" --format={guid} "$@"; }

cd "$WK"
switch_flow() {
  cat <<CS
using System;

public class SwitchFlow
{
    readonly Workspace workspace;

    public SwitchFlow(Workspace workspace) => this.workspace = workspace;

    public void Switch(Branch target)
    {
$1
    }

    static void Log(string message) => Console.WriteLine(message);
}
CS
}
w Assets/Scripts/SwitchFlow.cs "$(switch_flow '        workspace.Update(target);')"
w Assets/Scripts/LegacySwitch.cs "public class LegacySwitch { }"
w README.md "# Code reviews"
banner 0 Assets/Art/Banner.png
checkin "$(text initial 'Initial project')"

cm mkbr main/task-2210 -c="Switching keeps pending changes in \`SwitchFlow\`" >/dev/null
cm switch main/task-2210 >/dev/null
w Assets/Scripts/SwitchFlow.cs "$(switch_flow '        var shelve = workspace.Shelve();
        workspace.Undo();
        workspace.Update(target);
        workspace.Apply(shelve);')"
w Assets/Scripts/Retry.cs "public static class Retry
{
    public static void Times(int count, Action action) { for (var i = 0; i < count; i++) action(); }
}"
rm Assets/Scripts/LegacySwitch.cs
banner 1 Assets/Art/Banner.png
checkin "$(text shelve 'Shelve, undo, switch, bring')"
FIRST=$(changeset /main/task-2210)

w Assets/Scripts/Retry.cs "public static class Retry
{
    public static void Times(int count, Action action)
    {
        for (var i = 0; i < count; i++) action();
    }
}"
# A long file, for comments gone to far down it and near its end (where the view stops scrolling).
w Assets/Scripts/Commands.cs "$(echo 'public static class Commands'; echo '{'; for i in $(seq 1 796); do echo "    public static string Command$i => \"command $i\";"; done; echo '}')"
# A file with Windows line ends, which a suggestion applied keeps.
sleep 1
printf 'public static class Settings\r\n{\r\n    public const int Retries = 3;\r\n    public const int TimeoutSeconds = 30;\r\n}\r\n' > Assets/Scripts/Settings.cs
checkin "$(text retry '`Retry` reads better on several lines')"

REVIEW=$(cm cr br:/main/task-2210 "Switch with changes" --users=me --format={id} \
  --descriptionfile="$(text description 'Switching with pending changes **never loses them**:

1. Shelve the changes (`ShelveChanges`)
2. Undo them, switch, then bring them back

Follows cs:'"$FIRST"'.')")

GENERAL=$(on_review -commentsfile="$(text general 'Nice work. Could we add a test for a switch that **fails**, where `Switch()` throws?')")
cm cr comment reply "$GENERAL" -c="Yes, in the next changeset." >/dev/null

APPLIED=$(on_review --path=/Assets/Scripts/SwitchFlow.cs --line=11 --type=Change -c="Undo before shelving fails: shelve first.")
on_review --path=/Assets/Scripts/SwitchFlow.cs --line=14 --type=Change -c="Log the shelve number here." >/dev/null
DISCARDED=$(on_review --path=/Assets/Scripts/SwitchFlow.cs --line=13 --type=Change -c="Rename target to destination.")
cm cr comment reply "$DISCARDED" --discard -c="Target is the word cm uses." >/dev/null
BY_HAND=$(on_review --path=/Assets/Scripts/Retry.cs --line=5 --type=Change -c="Stop after the first success.")
ELSEWHERE=$(on_review --path=/Assets/Scripts/Retry.cs --line=3 --type=Change -c="Add a test for Times.")
ANSWERED=$(on_review --path=/Assets/Scripts/Retry.cs --line=3 --type=Question -c="Why not a while loop?")
cm cr comment reply "$ANSWERED" -c="A for loop shows the count." >/dev/null
on_review --path=/Assets/Scripts/SwitchFlow.cs --line=1 --type=Question -c="Is \`System\` still needed?" >/dev/null
on_review --path=/Assets/Scripts/SwitchFlow.cs --line=13 --type=Question -c="Does Update keep the shelve if it fails?" >/dev/null
EDITED=$(on_review --path=/Assets/Scripts/Retry.cs --line=1 --type=Comment -c="Static clas reads well.")
sleep 1
cm cr comment edit "$EDITED" -c="Static class reads well." >/dev/null
on_review --path=/Assets/Scripts/LegacySwitch.cs --line=1 --type=Comment -c="Glad to see this one go." >/dev/null
on_review --path=/Assets/Scripts/Commands.cs --line=400 --type=Change -c="Name it after what it does." >/dev/null
# Two lines below the open one, a plain comment: so close in a long file that their ticks in the scrollbar fuse.
on_review --path=/Assets/Scripts/Commands.cs --line=402 --type=Comment -c="This one reads well." >/dev/null
on_review --path=/Assets/Scripts/Commands.cs --line=796 --type=Question -c="Is the last command still used?" >/dev/null
on_review --path=/Assets/Scripts/SwitchFlow.cs --line=12 --changeset="cs:$FIRST" --type=Comment -c="In this changeset alone, the update comes last." >/dev/null
# Suggested changes. This one's line changes in the check-in below, so it reads outdated.
suggest() { on_review --path="$1" --line="$2" --type="${4:-Change}" -commentsfile="$(text "suggestion-$2-${4:-Change}" "$3")" >/dev/null; }
suggest /Assets/Scripts/SwitchFlow.cs 13 'Bring the changes back if the update fails:
```suggestion
        workspace.Update(target, onFailure: () => workspace.Apply(shelve));
```'
suggest /Assets/Scripts/Retry.cs 5 'Braces, as the rest of the file:
```suggestion
        for (var i = 0; i < count; i++)
        {
            action();
        }
```'
suggest /Assets/Scripts/Commands.cs 3 'Nothing calls `Command1`:
```suggestion
```'
suggest /Assets/Scripts/Settings.cs 4 '```suggestion
    public const int TimeoutSeconds = 60;
```'
# On a range of lines: the three properties it replaces stay as they are, so it stays open at lines 10–12.
suggest /Assets/Scripts/Commands.cs 10-12 'One list reads better than three properties:
```suggestion
    public static readonly string[] Some = { "command 8", "command 9", "command 10" };
```'
# A range whose middle line the check-in below edits: outdated, its snippet marking all three lines.
on_review --path=/Assets/Scripts/SwitchFlow.cs --line=12-14 --type=Question -c="Could these three calls be one?" >/dev/null
suggest /Assets/Scripts/Retry.cs 3 'Would this read better?
```suggestion
    public static void Times(int count, Action action, Action onEach)
```' Question

# Comments on the banner as the first changeset left it: a point, an area, one answered. The check-in below repaints it,
# so they're on its earlier version.
on_review --path=/Assets/Art/Banner.png --location=image:150,60 --type=Question -c="Is the sun meant to move this far?" >/dev/null
SUN=$(on_review --path=/Assets/Art/Banner.png --location=image:0,110,320,90 --type=Change -c="The hills read too orange against the sky.")
cm cr comment reply "$SUN" -c="Agreed, I'll make them purple." >/dev/null

cm cr -e "$REVIEW" --title="Switching with changes keeps them" >/dev/null
cm cr review "$REVIEW" --rework-required -c="Two changes before it goes in." >/dev/null

# The change request applied by a check-in: its comment names it, and the revision its comment is on becomes an older one.
# It edits line 13 too: the comments on it are outdated. It adds a test as well, which See in context lists beside the
# comment as what else the fix changed.
w Assets/Tests/SwitchFlowTests.cs "public class SwitchFlowTests
{
    public void ShelvesBeforeUndoing() { }
}"
w Assets/Scripts/SwitchFlow.cs "$(switch_flow '        var shelve = workspace.Shelve();
        workspace.Undo();
        workspace.Update(target, onFailure: () => workspace.Apply(shelve));
        workspace.Apply(shelve);
        Log("Switched");')"
checkin "$(text apply "Shelve before undoing [apply-change:${APPLIED:0:8}]")"
cm cr comment apply "$BY_HAND" --changeset="cs:$(changeset /main/task-2210)" >/dev/null

# A change request applied in other files than its own: the test it asked for, alone. See in context lists that
# changeset's files, the request above them.
w Assets/Tests/RetryTests.cs "public class RetryTests
{
    public void RunsTheActionTheTimesAsked() { }
}"
checkin "$(text test "Test Retry.Times [apply-change:${ELSEWHERE:0:8}]")"
# The banner repainted: comments on its newest version, a point and an area, and one answered.
banner 2 Assets/Art/Banner.png
checkin "$(text banner "Purple hills [apply-change:${SUN:0:8}]")"
on_review --path=/Assets/Art/Banner.png --location=image:210,62 --type=Comment -c="The sun sits well here now." >/dev/null
on_review --path=/Assets/Art/Banner.png --location=image:40,130,120,60 --type=Change -c="Soften this hill's edge." >/dev/null
ASKED=$(on_review --path=/Assets/Art/Banner.png --location=image:290,20 --type=Question -c="Do we need this corner of sky?")
cm cr comment reply "$ASKED" -c="Yes: the title goes there." >/dev/null
# On the newest revision: a line replaced by one.
suggest /Assets/Scripts/SwitchFlow.cs 15 'Say where it switched to:
```suggestion
        Log($"Switched to {target.Name}");
```'
# A line wrapped in a new condition: the line diff alone would show the condition above the line, as if already there.
suggest /Assets/Scripts/SwitchFlow.cs 14 'Nothing to bring back when there were no changes:
```suggestion
        if (shelve != null)
            workspace.Apply(shelve);
```'

cm switch main >/dev/null
w README.md "# Code reviews

Switching keeps pending changes."
checkin "$(text readme 'Explain switching')"
cm cr "cs:$(changeset /main)" "Explain switching in the \`README.md\`" --users=me >/dev/null
w README.md "# Code reviews (draft)"
cm shelveset create --all -c="Draft README" >/dev/null
cm undo -r . >/dev/null
SHELVE=$(cm find shelve --format={shelveid} --nototal | tail -n 1)
cm cr "sh:$SHELVE" "Draft README" >/dev/null
cm switch main/task-2210 >/dev/null

echo "Built $REPO in $WK: code review $REVIEW (with comments), a changeset review and a shelve review"
