#!/usr/bin/env bash
# Builds a repository whose last changeset and pending changes move code inside files: a function moved as it was,
# one moved and edited a little, one moved far down a long file (its two places screens apart), one re-indented into
# a class, next to plain edits, a block rewritten (removed and added, not moved) and lines only removed.
# Usage: scripts/sandboxes/moved-code.sh   → repo moved-code-demo@local, workspace /tmp/uvcs-moved-code-demo
set -euo pipefail
REPO=moved-code-demo@local
WK=/tmp/uvcs-moved-code-demo

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create moved-code-demo "$WK" "$REPO" >/dev/null
cd "$WK"
mkdir -p src

# Functions the files are made of, each named, so a move is easy to follow on screen.
fn_total() { cat <<'EOF'
export function total(items: CartItem[]): number {
  let sum = 0;
  for (const item of items) sum += item.price * item.quantity;
  return sum;
}
EOF
}
fn_format() { cat <<'EOF'
export function formatPrice(amount: number, currency = 'EUR'): string {
  const formatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency });
  return formatter.format(amount);
}
EOF
}
fn_format_edited() { cat <<'EOF'
export function formatPrice(amount: number, currency = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return formatter.format(amount);
}
EOF
}
fn_discount() { cat <<'EOF'
export function applyDiscount(items: CartItem[], code: string): CartItem[] {
  const rate = DISCOUNTS[code] ?? 0;
  if (rate === 0) return items;
  return items.map((item) => ({ ...item, price: item.price * (1 - rate) }));
}
EOF
}
fn_validate() { cat <<'EOF'
function validate(item: CartItem): string[] {
  const problems: string[] = [];
  if (!item.name.trim()) problems.push('A name is missing');
  if (item.quantity <= 0) problems.push('The quantity must be positive');
  if (item.price < 0) problems.push('The price cannot be negative');
  return problems;
}
EOF
}
filler() { for i in $(seq "$2" "$3"); do printf 'export const %s%d = { id: %d, label: "%s %d" };\n' "$1" "$i" "$i" "$1" "$i"; done; }

header() { cat <<'EOF'
import type { CartItem } from './types';
import { DISCOUNTS } from './discounts';

EOF
}

{ header; fn_total; echo; fn_format; echo; fn_discount; echo; filler preset 1 120; echo; fn_validate; echo; filler legacy 1 4; } > src/cart.ts
cm add -R src >/dev/null
cm ci --all -c "A cart with prices and discounts" >/dev/null

# Checked in: what a changeset's diff shows. total moves to the end as it was; formatPrice moves down and changes
# its locale; validate moves from the bottom to the top, screens away; a plain edit and lines removed.
sleep 1
{ header; fn_validate; echo; fn_discount | sed 's/?? 0/?? 0.05/'; echo; filler preset 1 60; filler preset 62 120; echo; fn_format_edited; echo; fn_total; } > src/cart.ts
cm ci --all -c "Group the cart helpers by what they do" >/dev/null

# Pending: what Changes shows. validate moves to the end as it was; total goes into a class, re-indented and changed
# too much to be a move; a block is rewritten in place.
sleep 1
{
  header
  echo 'export function applyDiscount(items: CartItem[], code: string): CartItem[] {'
  echo '  return items.map((item) => ({ ...item, price: item.price * (1 - (DISCOUNTS[code] ?? 0)) }));'
  echo '}'
  echo
  echo 'export class Cart {'
  echo '  constructor(private readonly items: CartItem[]) {}'
  echo
  fn_total | sed 's/^/  /' | sed 's/export function total(items: CartItem\[\])/total()/; s/of items/of this.items/'
  echo '}'
  echo
  filler preset 1 60
  filler preset 62 120
  echo
  fn_format_edited
  echo
  fn_validate
} > src/cart.ts
cm co src/cart.ts >/dev/null 2>&1 || true
echo "Built $REPO in $WK"
