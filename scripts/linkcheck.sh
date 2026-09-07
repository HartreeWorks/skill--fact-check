#!/bin/sh
# HTTP status, final URL and <title> for every outbound link.
# Usage: linkcheck.sh <links.txt> [out.tsv]     (links.txt: one URL per line, from extract_document.py)
# A 403 or 429 usually means bot blocking, not a dead link; check those in a browser or via fetch_source.py's Wayback path.
set -u
LINKS="$1"; OUT="${2:-$(dirname "$1")/links.tsv}"
: > "$OUT"
while read -r u; do
  [ -z "$u" ] && continue
  tmp=$(mktemp)
  code=$(curl -sL -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/128 Safari/537.36" -o "$tmp" -w '%{http_code}\t%{url_effective}' --max-time 25 "$u")
  title=$(grep -o '<title[^>]*>[^<]*' "$tmp" | head -1 | sed 's/<title[^>]*>//' | tr -s ' \n' ' ')
  printf '%s\t%s\t%s\n' "$u" "$code" "$title" | tee -a "$OUT"
  rm -f "$tmp"
done < "$LINKS"
echo "wrote $OUT"
