#!/usr/bin/env bash
# Builds a repository some of whose file revisions a purge removed, to see a diff with versions that can't be read: a
# text, a PNG and a binary file changed in four changesets, the first labeled, and a branch /main/task from cs:2 that
# changes them too. A purge keeps labeled revisions and every branch head's, so it removes those of cs:2 and cs:3:
# cs:2's diff has its later version purged, cs:3's both, cs:4's its earlier one. Merging /main/task into the workspace
# (on /main) conflicts on all three, whose base, cs:2's, was purged: the merge page.
# Usage: scripts/sandboxes/purged.sh [repo-name [workspace-folder]]   → repo purge-demo@local, workspace /tmp/uvcs-purged
# It deletes and recreates both, so it takes only names: the repository is always on the local server, the workspace
# always a folder of /tmp. Purging needs the purge permission on the local server, which it doesn't grant:
# `cm acl --user=<you> -allowed=+purge repserver:local`, once.
set -euo pipefail
NAME=${1:-purge-demo}
FOLDER=${2:-uvcs-purged}
case "$NAME/$FOLDER" in
  */*/* | *@* | *..* | */. | */-* | *[[:space:]]*) echo "Give names only (no server, no path): $NAME $FOLDER" >&2; exit 1 ;;
esac
REPO="$NAME@local"
WK="/tmp/$FOLDER"

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK"
cm wk create "$(basename "$WK")" "$WK" "$REPO" >/dev/null

# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
commit() { sleep 1; cm ci --all --private -c "$1" >/dev/null; }
# A 1×1 PNG of the given color (RGB hex): a real image, so the diff shows it as one.
png() { python3 -c "import sys,zlib,struct
c=bytes.fromhex(sys.argv[1]); raw=b'\0'+c
chunk=lambda t,d: struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
sys.stdout.buffer.write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))" "$1" > "$2"; }
version() {
  printf 'notes, version %s\n' "$1" > notes.txt
  png "$2" logo.png
  printf 'data %s\0\1\2' "$1" > data.bin
}

cd "$WK"
version 1 ff0000; commit "First version"
cm label create lb:first cs:1 >/dev/null
version 2 00ff00; commit "Second version"
version 3 0000ff; commit "Third version"
version 4 ffff00; commit "Fourth version"
cm branch create /main/task --changeset=cs:2 >/dev/null
cm switch br:/main/task >/dev/null
version task ff00ff; commit "The task's version"
cm switch br:/main >/dev/null

# A purge takes revisions older than a minute: wait into the next one, so it takes every changeset above.
sleep $((61 - 10#$(date +%S)))
PURGE=$(cm purge register .txt "$(date +%H:%M)" .png "$(date +%H:%M)" .bin "$(date +%H:%M)" --repository="$REPO")
echo y | cm purge execute "$PURGE" --server=local >/dev/null
for _ in $(seq 60); do
  cm purge history --server=local | grep -q "^$PURGE PurgeCompleted" && break
  sleep 1
done
cm purge history --server=local | grep -q "^$PURGE PurgeCompleted" || { echo "The purge $PURGE didn't complete in a minute" >&2; exit 1; }
echo "Built $REPO in $WK: cs:2's diff has its later versions purged, cs:3's both, cs:4's its earlier ones; merging /main/task conflicts on a purged base"
