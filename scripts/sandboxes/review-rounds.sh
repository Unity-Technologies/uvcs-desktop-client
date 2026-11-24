#!/usr/bin/env bash
# Builds a repository whose code review went back and forth over rounds: the review is asked for, the reviewer asks
# for rework (a change request and a question), the author fixes it (a changeset applying the request, an answer) and
# asks again, the reviewer asks for rework once more (two change requests and a question), then, after that status,
# the author applies one, discards the other with a reply, answers the question naming its fix, merges main into the
# branch, checks in more and comments, and the reviewer leaves one more question open. The reviewer is the signed-in
# user, so the conversation shows their rounds folded, "New since your last review" after their last status, the
# check-ins, and Changes the changesets new since then, with the Comments panel toggle counting the open question.
# A second review asks the user for a review, as the Code reviews list marks one waiting for them.
# Usage: scripts/sandboxes/review-rounds.sh [repo-name [workspace-folder]]   → repo review-rounds@local, workspace /tmp/uvcs-review-rounds
# It deletes and recreates both, so it takes only names: the repository is always on the local server, the workspace
# always a folder of /tmp.
set -euo pipefail
NAME=${1:-review-rounds}
FOLDER=${2:-uvcs-review-rounds}
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
# cm detects edits by timestamp, and the rounds are told apart by the second each thing happened.
w() { sleep 1; mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" > "$1"; }
checkin() { cm ci --all --private -commentsfile="$1" >/dev/null; }
changeset() { cm find "changeset where branch = '$1'" "order by changesetid desc" limit 1 --format={changesetid} --nototal; }
on_review() { sleep 1; cm cr comment add "$REVIEW" --format={guid} "$@"; }
status() { sleep 1; cm cr review "$REVIEW" "$@" >/dev/null; }

cd "$WK"
spawner() {
  cat <<CS
public class WaveSpawner
{
    public void Spawn(Wave wave)
    {
$1
    }
}
CS
}
w Assets/Waves/WaveSpawner.cs "$(spawner '        var count = wave.count;
        for (var i = 0; i < count; i++) Pool.Take();')"
w Assets/Waves/EnemyPool.cs "public class EnemyPool { public Enemy Take() => new Enemy(); }"
w README.md "# Waves"
checkin "$(text initial 'Initial project')"

cm mkbr main/waves -c="Enemy spawner waves" >/dev/null
cm switch main/waves >/dev/null
w Assets/Waves/WaveSpawner.cs "$(spawner '        var count = wave.count;
        for (var i = 0; i < count; i++) Pool.Take().Spawn(wave.origin);')"
checkin "$(text spawn 'Spawn each enemy at the wave origin')"
w Assets/Waves/Wave.cs "public class Wave { public int count; public Vector3 origin; }"
checkin "$(text wave 'A wave knows its size and origin')"

REVIEW=$(cm cr br:/main/waves "Enemy spawner waves" --users=me --format={id} \
  --descriptionfile="$(text description 'Waves spawn their enemies at the wave origin.')")

# Round 1: a request and a question, then rework required.
CAP=$(on_review --path=/Assets/Waves/WaveSpawner.cs --line=5 --type=Change -c="Cap this by maxAlive: a big wave spawns 400 at once.")
WHY=$(on_review --path=/Assets/Waves/EnemyPool.cs --line=1 --type=Question -c="Why a new Enemy each time?")
status --rework-required -c="Cap the wave first."

# The author fixes it, answers, and asks again.
w Assets/Waves/WaveSpawner.cs "$(spawner '        var count = Math.Min(wave.count, maxAlive);
        for (var i = 0; i < count; i++) Pool.Take().Spawn(wave.origin);')"
checkin "$(text cap "Cap a wave by maxAlive [apply-change:${CAP:0:8}]")"
sleep 1
cm cr comment reply "$WHY" -c="The pool comes next; this keeps the change small." >/dev/null
status --re-request --users=me

# Round 2: two more requests and a question, then rework required again, said at length: the reviewer's checkpoint.
TICK=$(on_review --path=/Assets/Waves/WaveSpawner.cs --line=5 --type=Change -c="Cap a single tick too: maxPerTick.")
POOL=$(on_review --path=/Assets/Waves/EnemyPool.cs --line=1 --type=Change -c="Drop the pool, allocate per wave instead.")
ORIGIN=$(on_review --path=/Assets/Waves/Wave.cs --line=1 --type=Question -c="Is the origin in world space or local to the spawner?")
status --rework-required -commentsfile="$(text rework2 'Close, two things left.

1. A big wave still spawns everything in one tick: cap a single tick too.
2. The pool: allocating per wave reads simpler, unless something else reuses it.

And one question on the origin, see the comment on Wave.cs. The rest reads well.')"

# Since the last review: one request applied, the other discarded, the question answered by naming its fix, main merged in, a run of
# changesets (more than the conversation lists before "N more"), and a comment.
w Assets/Waves/WaveSpawner.cs "$(spawner '        var count = Math.Min(Math.Min(wave.count, maxAlive), wave.maxPerTick);
        for (var i = 0; i < count; i++) Pool.Take().Spawn(wave.origin);')"
checkin "$(text tick "Cap a single tick too [apply-change:${TICK:0:8}]")"
sleep 1
cm cr comment reply "$POOL" --discard -c="The boss wave reuses it; per wave doubles the GC spikes." >/dev/null
# The question answered by naming the changeset that fixes it: the app shows it beside that changeset's diff.
w Assets/Waves/Wave.cs "public class Wave { public int count; /* In world space: the spawner places the wave. */ public Vector3 origin; }"
checkin "$(text origin 'Say the wave origin is in world space')"
cm cr comment reply "$ORIGIN" -c="World space: the spawner places the wave. Written down in cs:$(changeset /main/waves)." >/dev/null

cm switch main >/dev/null
w README.md "# Waves

Enemies come in waves."
checkin "$(text readme 'Explain waves')"
cm switch main/waves >/dev/null
sleep 1
cm merge br:/main --merge -c="Merge from /main" >/dev/null
checkin "$(text merge 'Merge from /main')"

for step in "Tests for the tick cap" "Name the tick limit in the inspector" "Log a wave that hits the cap" \
  "Spread a capped wave over the next ticks" "Keep the boss wave out of the cap" "Tests for spreading a wave" "Tidy the spawner's fields"; do
  w "Assets/Tests/WaveSpawnerTests.cs" "public class WaveSpawnerTests { /* $step */ }"
  checkin "$(text step "$step")"
done
on_review -c="All three done: the tick cap is in, the pool stays (see the reply), and the origin is answered." >/dev/null
# One question still open, as the Comments panel toggle counts it.
on_review --path=/Assets/Tests/WaveSpawnerTests.cs --line=1 --type=Question -c="Do these cover a wave smaller than the cap?" >/dev/null

# A second review waiting for the reviewer, as the Code reviews list marks one.
cm mkbr main/ladder -c="Fix ladder clipping" >/dev/null
cm switch main/ladder >/dev/null
w Assets/Player/Ladder.cs "public class Ladder { public float snap = 0.1f; }"
checkin "$(text ladder 'Snap the player to the ladder')"
cm cr br:/main/ladder "Fix ladder clipping" --users=me >/dev/null
cm switch main/waves >/dev/null

echo "Built $REPO in $WK: code review $REVIEW, two rounds of rework, then fixes since the last review; another review waits for you"
