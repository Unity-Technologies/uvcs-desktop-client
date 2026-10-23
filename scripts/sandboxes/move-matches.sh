#!/usr/bin/env bash
# Builds a workspace for Search matches: files deleted from disk, and hundreds of new (private) files, each at a known
# similarity to one of them, as cm's move detection measures it.
#   - Five deleted C# files, each with 21 new versions from 100% to 0% similar (every 5%), spread over folders, one of
#     them under the deleted file's own name in another folder at 40%.
#   - Two deleted binary files (.png, .fbx) with new ones of sizes from 100% to 0% alike, and a .psd of the same size,
#     which isn't offered (a binary file pairs only with its extension).
#   - The other way round, for Search matches on a new file: src/Gameplay/WeaponSystem.cs, with 27 deleted versions of
#     it in src/Legacy/Weapons from 100% to 0% (every 5%, and 97, 88, 67, 33, 12 and 3%), and art/Textures/Weapon.png
#     with 21 deleted ones in art/Textures/Old, by size.
#   - 300 unrelated new files (0%), a log too large to measure (–), and a deleted folder with a new one.
# Changes pairs on its own whatever is past its similarity setting: turn off "Detect moved and renamed files" in
# Settings › Pending changes to see every deleted file, and every version, in Search matches.
# Usage: scripts/sandboxes/move-matches.sh   → repo move-matches-demo@local, workspace /tmp/uvcs-move-matches-demo
set -euo pipefail
REPO=move-matches-demo@local
WK=/tmp/uvcs-move-matches-demo
LINES=200

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create move-matches-demo "$WK" "$REPO" >/dev/null
cd "$WK"

# A class of $LINES lines; `changed` of them (every other line from the top) rewritten. Each rewritten line is one line
# removed and one added: rewriting half the lines leaves nothing alike.
class_file() { # <path> <class> <changed>
  mkdir -p "$(dirname "$1")"
  awk -v name="$2" -v lines="$LINES" -v changed="$3" 'BEGIN {
    for (i = 1; i <= lines; i++)
      if (i % 2 == 0 && i / 2 <= changed) printf "    public string Rewritten%d = \"%s %d\";\n", i, name, i;
      else printf "    public int %sValue%d = %d;\n", name, i, i;
  }' > "$1"
}
bytes() { mkdir -p "$(dirname "$1")"; head -c "$2" /dev/urandom > "$1"; }

CLASSES=(PlayerController InventorySystem EnemySpawner SaveGameManager AudioMixer)
# The deleted versions of the new WeaponSystem.cs: every 5%, and a few in between.
WEAPON_SIMILARITIES=($(seq 0 5 100) 97 88 67 33 12 3)
FOLDERS=(src/Gameplay src/Gameplay/Characters src/Systems src/Systems/Persistence src/UI src/Audio tools/Editor)

for class in "${CLASSES[@]}"; do class_file "src/Legacy/$class.cs" "$class" 0; done
bytes art/Textures/Hero.png 20000
bytes art/Models/Hero.fbx 50000
for name in Old1 Old2 Old3; do class_file "src/Retired/$name.cs" "$name" 0; done
# Similarity s% has (100 - s) / 2 % of the lines rewritten.
for similarity in "${WEAPON_SIMILARITIES[@]}"; do
  class_file "src/Legacy/Weapons/WeaponSystemAt$similarity.cs" WeaponSystem $((LINES * (100 - similarity) / 200))
done
# By size, against the new 20,000-byte Weapon.png: s% is a deleted file of 2,000,000 / (200 - s) bytes.
for similarity in $(seq 0 5 100); do bytes "art/Textures/Old/WeaponAt$similarity.png" $((2000000 / (200 - similarity))); done
# The new files' folders, checked in empty: cm moves a file only into a folder under version control.
mkdir -p "${FOLDERS[@]}" logs && for batch in $(seq 0 11); do mkdir -p "src/Generated/Batch$batch"; done
cm add -R . >/dev/null
cm ci --all -c "Initial layout" >/dev/null

# Deleted from disk, outside cm: Changes lists them as deleted.
rm src/Legacy/*.cs src/Legacy/Weapons/*.cs art/Textures/Hero.png art/Models/Hero.fbx art/Textures/Old/*.png
rm -rf src/Retired

# New versions of each class: similarity 100 - 5k% has (5k / 2)% of the lines rewritten.
for class in "${CLASSES[@]}"; do
  for step in $(seq 0 20); do
    similarity=$((100 - step * 5))
    folder=${FOLDERS[$(( (step + ${#class}) % ${#FOLDERS[@]} ))]}
    class_file "$folder/${class}At${similarity}.cs" "$class" $((LINES * step * 5 / 200))
  done
done
# The new file the deleted WeaponSystemAt*.cs and WeaponAt*.png were.
class_file src/Gameplay/WeaponSystem.cs WeaponSystem 0
bytes art/Textures/Weapon.png 20000
# The deleted file's own name in another folder, though far from its content.
class_file src/Gameplay/Characters/PlayerController.cs PlayerController $((LINES * 60 / 200))

# Binary files are measured by size: 100%, 95%, 80%, 60%, 30%, 0%.
for size in 20000 19000 16000 12000 6000 40000; do bytes "art/Textures/Hero_$size.png" "$size"; done
for size in 50000 45000 35000 15000 120000; do bytes "art/Models/Hero_$size.fbx" "$size"; done
bytes art/Textures/Hero.psd 20000

# Unrelated new files, all 0%, and one too large to measure.
for index in $(seq 1 300); do class_file "src/Generated/Batch$((index % 12))/Unrelated$index.cs" "Unrelated$index" 0; done
mkdir -p logs && awk 'BEGIN { for (i = 0; i < 120000; i++) printf "build step %d finished in %d ms\n", i, i % 997 }' > logs/build.log

# A folder renamed (a new one, not checked in): no similarity for folders, only the name ranking.
class_file src/Archive/Old1.cs Old1 0

echo "Built $REPO in $WK"
