#!/bin/sh
# check-migrations.sh: enforce ADDITIVE-ONLY database migrations.
#
# Why: when a deploy rolls back, the previous app version runs against the
# new schema, so a merged migration must never remove or change anything the
# old code uses. Already-merged migrations must never be edited either.
#
# Allowed, statement by statement:
#   CREATE ...                       (tables, indexes, enums, sequences…; not OR REPLACE)
#   ALTER TABLE ... ADD COLUMN ...   (new NOT NULL columns need a DEFAULT)
#   ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...
#   ALTER TYPE ... ADD VALUE ...     (new enum values)
#   INSERT INTO ...                  (seed rows)
#   COMMENT ON ...
# Everything else (DROP, RENAME, ALTER COLUMN, UPDATE, DELETE, TRUNCATE, block
# comments, function bodies, …) is rejected. That's deliberately strict and
# fails closed: when in doubt, it says no.
#
# Usage:
#   check-migrations.sh --against origin/main   check this branch's migration changes (app repo, local)
#   check-migrations.sh FILE.sql ...            check SQL files
#   check-migrations.sh - LABEL                 check SQL on stdin
# Exit: 0 ok, 1 violation (reasons on stderr), 2 usage error.
#
# The SAME file lives in ultimate-finder-deploy/scripts/ (the copy the server
# enforces) and in the app repo (advisory, for local checks). Keep them
# identical. POSIX sh + awk: runs on macOS and in Alpine.

check_sql() { # LABEL, with SQL on stdin
  awk -v label="$1" '
    { buf = buf $0 "\n" }
    END {
      bad = 0
      if (index(buf, "/*") > 0) {
        printf "%s: block comments (/* */) are not allowed in migrations\n", label > "/dev/stderr"; bad = 1
      }
      n = split(buf, lines, "\n"); s = ""
      for (i = 1; i <= n; i++) { l = lines[i]; p = index(l, "--"); if (p > 0) l = substr(l, 1, p - 1); s = s " " l }
      s = toupper(s)
      gsub(/[ \t\r]+/, " ", s)
      m = split(s, st, ";")
      for (i = 1; i <= m; i++) {
        t = st[i]; sub(/^ +/, "", t); sub(/ +$/, "", t)
        if (t == "") continue
        ok = 0; why = ""
        if (t ~ /^CREATE OR REPLACE /) why = "CREATE OR REPLACE changes an existing object"
        else if (t ~ /^CREATE /) ok = 1
        else if (t ~ /^INSERT INTO /) ok = 1
        else if (t ~ /^COMMENT ON /) ok = 1
        else if (t ~ /^ALTER TYPE / && t ~ / ADD VALUE /) ok = 1
        else if (t ~ /^ALTER TABLE /) {
          u = substr(t, 13)
          gsub(/ ON (DELETE|UPDATE) (SET NULL|SET DEFAULT|CASCADE|RESTRICT|NO ACTION)/, "", u)
          if (u ~ /(^| )(DROP|RENAME|ALTER|SET|RESET|TYPE|OWNER|DISABLE|ENABLE|NO|INHERIT|VALIDATE|CLUSTER|DETACH|ATTACH|REPLICA|FORCE|USING)( |$)/)
            why = "ALTER TABLE may only ADD COLUMN or ADD CONSTRAINT ... FOREIGN KEY"
          else if (u !~ / ADD (COLUMN|CONSTRAINT) /)
            why = "ALTER TABLE may only ADD COLUMN or ADD CONSTRAINT ... FOREIGN KEY"
          else {
            k = split(u, cs, / ADD CONSTRAINT /)
            for (j = 2; j <= k; j++) if (cs[j] !~ /FOREIGN KEY/) why = "the only constraint you may add to an existing table is a FOREIGN KEY"
            k = split(u, segs, / ADD COLUMN /)
            for (j = 2; j <= k; j++) if (segs[j] ~ /NOT NULL/ && segs[j] !~ / DEFAULT /) why = "a new NOT NULL column needs a DEFAULT (or make it optional)"
            if (why == "") ok = 1
          }
        }
        else why = "only CREATE, INSERT, ALTER TABLE ... ADD, ALTER TYPE ... ADD VALUE and COMMENT ON are allowed"
        if (!ok) {
          printf "%s: %s\n    -> %s\n", label, why, substr(t, 1, 100) > "/dev/stderr"; bad = 1
        }
      }
      exit bad
    }'
}

case "${1:-}" in
  --against)
    ref=${2:?usage: check-migrations.sh --against <git-ref>}
    base=$(git merge-base "$ref" HEAD) || { echo "can't find merge-base with $ref" >&2; exit 2; }
    tab=$(printf '\t'); bad=0; found=0
    tmp=$(mktemp)
    # Tracked changes since the branch point (working tree included), plus brand-new untracked files.
    git diff --name-status --no-renames "$base" -- prisma/migrations > "$tmp"
    git ls-files --others --exclude-standard -- prisma/migrations | sed "s/^/A$tab/" >> "$tmp"
    while IFS="$tab" read -r status path; do
      case "$path" in */migration.sql) ;; *) continue ;; esac
      found=1
      if [ "$status" = "A" ]; then
        check_sql "$path" < "$path" || bad=1
      else
        echo "$path: migrations already on $ref must never be edited or deleted (git status: $status)" >&2; bad=1
      fi
    done < "$tmp"
    rm -f "$tmp"
    if [ "$bad" -eq 0 ]; then
      [ "$found" -eq 1 ] && echo "migrations OK: additive only" || echo "no migration changes"
    fi
    exit "$bad"
    ;;
  -)
    check_sql "${2:-stdin}"; exit $?
    ;;
  ""|-h|--help)
    sed -n '2,27p' "$0" >&2; exit 2
    ;;
  *)
    bad=0
    for f in "$@"; do check_sql "$f" < "$f" || bad=1; done
    exit "$bad"
    ;;
esac
