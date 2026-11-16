#!/bin/sh
# check-migrations.sh: keep database migrations ADDITIVE ONLY.
#
# Why: when a deploy rolls back, the previous app version runs against the
# new schema, so a merged migration must never remove or change anything the
# old code uses. Already-merged migrations must never be edited either.
#
# What this is: a guard against MISTAKES (an honest DROP, rename or retype),
# not a security boundary. Deliberate sabotage is out of scope, because the
# app owns its tables and could delete data at runtime anyway. The defences
# for that are isolation, the non-superuser role, and backups. See
# ultimate-finder-deploy/CLAUDE.md.
#
# Accepted statements (anything else is rejected; it fails closed):
#   CREATE TABLE <name> ( ... )               (not AS / LIKE / INHERITS / PARTITION)
#   CREATE [UNIQUE] INDEX ... ON <table> ...  (UNIQUE only on a table created in the same migration)
#   CREATE TYPE <name> AS ENUM ( '...', ... )
#   CREATE SEQUENCE ...
#   ALTER TYPE <name> ADD VALUE [IF NOT EXISTS] '...' [BEFORE|AFTER '...']
#   ALTER TABLE <name> <action>, ...   where every action is:
#     ADD COLUMN <col> <type> [NULL | DEFAULT <constant> | NOT NULL DEFAULT <constant>]
#     ADD CONSTRAINT <name> FOREIGN KEY (...) REFERENCES <table> (...) [ON DELETE/UPDATE ...]
# Constants: '...', numbers, TRUE, FALSE, NULL, CURRENT_TIMESTAMP.
# Rejected outright: $-quoting, backslashes, E'' and U& strings, block comments.
#
# Usage:
#   check-migrations.sh --against origin/main   check this branch's migration changes (app repo)
#   check-migrations.sh FILE.sql ...            check SQL files
#   check-migrations.sh - LABEL                 check SQL on stdin
# Exit: 0 ok, 1 violation (reasons on stderr), 2 usage error.
#
# The SAME file lives in ultimate-finder-deploy/scripts/ (the copy the server
# enforces) and in the app repo (for local checks). Keep them identical.
# POSIX sh + awk: runs on macOS and in Alpine.

check_sql() { # LABEL, with SQL on stdin
  awk -v label="$1" '
    function err(msg, stmt) {
      printf "%s: %s\n", label, msg > "/dev/stderr"
      if (stmt != "") printf "    -> %s\n", pretty(stmt) > "/dev/stderr"
      bad = 1
    }
    function pretty(x,   out, k, n, w) {   # map QIDn placeholders back to "name"
      n = split(x, w, " "); out = ""
      for (k = 1; k <= n && length(out) < 110; k++) {
        if (w[k] ~ /^QID[0-9]+$/) out = out " \"" idname[substr(w[k], 4)] "\""
        else out = out " " w[k]
      }
      sub(/^ /, "", out); return out
    }
    function isconst(w) { return (w == "LIT" || w == "TRUE" || w == "FALSE" || w == "NULL" || w == "CURRENT_TIMESTAMP" || w ~ /^-?[0-9]+(\.[0-9]+)?$/) }
    function name_at(i,   nm) {   # [schema.]name starting at token i; sets NEXT
      nm = tk[i]; i++
      while (tk[i] == "." ) { nm = nm "." tk[i + 1]; i += 2 }
      NEXT = i; return nm
    }

    { buf = buf $0 "\n" }

    END {
      bad = 0; s = buf; n = length(s); out = ""; nid = 0
      # ---- lex: quotes become placeholders, comments go, punctuation is spaced ----
      for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        if (c == "\047") {                                   # 'string'
          p = substr(s, i - 1, 1); pp = (i > 2) ? substr(s, i - 2, 1) : " "
          if ((p == "E" || p == "e") && pp !~ /[A-Za-z0-9_]/) { err("E\047\047 strings are not allowed", ""); break }
          j = i + 1
          while (j <= n) {
            d = substr(s, j, 1)
            if (d == "\047") { if (substr(s, j + 1, 1) == "\047") { j += 2; continue } else break }
            j++
          }
          if (j > n) { err("unterminated string", ""); break }
          out = out " LIT "; i = j; continue
        }
        if (c == "\"") {                                     # "identifier"
          rest = substr(s, i + 1); j = index(rest, "\"")
          if (j == 0) { err("unterminated quoted identifier", ""); break }
          if (substr(rest, j + 1, 1) == "\"") { err("doubled quotes inside identifiers are not allowed", ""); break }
          nm = substr(rest, 1, j - 1)
          if (!(nm in idnum)) { nid++; idnum[nm] = nid; idname[nid] = nm }
          out = out " QID" idnum[nm] " "; i = i + j; continue
        }
        if (c == "-" && substr(s, i + 1, 1) == "-") {           # -- comment to end of line
          while (i <= n && substr(s, i, 1) != "\n") i++
          out = out " "; continue
        }
        if (c == "/" && substr(s, i + 1, 1) == "*") { err("block comments (/* */) are not allowed in migrations", ""); break }
        if (c == "$" || c == "\\" || c == "&") { err("characters $, \\ and & are not allowed in migrations", ""); break }
        if (c == ";" || c == "," || c == "(" || c == ")" || c == "." || c == "=") { out = out " " c " "; continue }
        if (c ~ /[ \t\r\n\f\v]/) { out = out " "; continue }
        out = out toupper(c)
      }
      if (bad) exit 1

      m = split(out, st, ";")
      for (si = 1; si <= m; si++) {
        stmt = st[si]; gsub(/ +/, " ", stmt); sub(/^ /, "", stmt); sub(/ $/, "", stmt)
        if (stmt == "") continue
        delete tk; k = split(stmt, tk, " ")

        # CREATE TABLE
        if (tk[1] == "CREATE" && tk[2] == "TABLE") {
          i = 3; if (tk[3] == "IF" && tk[4] == "NOT" && tk[5] == "EXISTS") i = 6
          t = name_at(i)
          if (tk[NEXT] != "(") { err("CREATE TABLE must define columns directly (no AS/LIKE/OF/PARTITION OF)", stmt); continue }
          if (stmt ~ /(^| )(AS|SELECT|LIKE|INHERITS|PARTITION|WITH|USING)( |$)/) { err("CREATE TABLE may only define columns and constraints", stmt); continue }
          created[t] = 1; continue
        }
        # CREATE [UNIQUE] INDEX
        if (tk[1] == "CREATE" && (tk[2] == "INDEX" || (tk[2] == "UNIQUE" && tk[3] == "INDEX"))) {
          on = 0; for (j = 1; j <= k; j++) if (tk[j] == "ON") { on = j; break }
          if (!on) { err("CREATE INDEX without ON", stmt); continue }
          i = on + 1; if (tk[i] == "ONLY") i++
          t = name_at(i)
          if (stmt ~ / WHERE | INCLUDE /) { err("partial/INCLUDE indexes are not allowed", stmt); continue }
          if (tk[2] == "UNIQUE" && !(t in created)) { err("a UNIQUE index on an existing table can break old code (duplicate-key errors); not additive", stmt); continue }
          continue
        }
        # CREATE TYPE ... AS ENUM ( LIT, ... )
        if (tk[1] == "CREATE" && tk[2] == "TYPE") {
          t = name_at(3)
          if (tk[NEXT] != "AS" || tk[NEXT + 1] != "ENUM" || tk[NEXT + 2] != "(" || tk[k] != ")") { err("CREATE TYPE is only allowed as AS ENUM (...)", stmt); continue }
          okk = 1; for (j = NEXT + 3; j < k; j++) if (tk[j] != "LIT" && tk[j] != ",") okk = 0
          if (!okk) err("enum values must be plain strings", stmt)
          continue
        }
        # CREATE SEQUENCE
        if (tk[1] == "CREATE" && tk[2] == "SEQUENCE") {
          if (stmt ~ / OWNED BY /) { err("CREATE SEQUENCE ... OWNED BY is not allowed", stmt) }
          continue
        }
        # ALTER TYPE name ADD VALUE [IF NOT EXISTS] LIT [(BEFORE|AFTER) LIT]
        if (tk[1] == "ALTER" && tk[2] == "TYPE") {
          t = name_at(3); i = NEXT
          if (tk[i] != "ADD" || tk[i + 1] != "VALUE") { err("ALTER TYPE may only ADD VALUE", stmt); continue }
          i += 2; if (tk[i] == "IF" && tk[i + 1] == "NOT" && tk[i + 2] == "EXISTS") i += 3
          if (tk[i] != "LIT") { err("ALTER TYPE ... ADD VALUE needs a plain string", stmt); continue }
          i++
          if ((tk[i] == "BEFORE" || tk[i] == "AFTER") && tk[i + 1] == "LIT") i += 2
          if (i <= k) err("unexpected text after ALTER TYPE ... ADD VALUE", stmt)
          continue
        }
        # ALTER TABLE name action, action...
        if (tk[1] == "ALTER" && tk[2] == "TABLE") {
          i = 3; if (tk[3] == "IF" && tk[4] == "EXISTS") i = 5
          if (tk[i] == "ONLY") i++
          t = name_at(i); i = NEXT
          # split actions on top-level commas
          na = 1; act[1] = ""; depth = 0
          for (j = i; j <= k; j++) {
            w = tk[j]
            if (w == "(") depth++
            if (w == ")") depth--
            if (w == "," && depth == 0) { na++; act[na] = ""; continue }
            act[na] = act[na] " " w
          }
          okall = 1
          for (a = 1; a <= na; a++) {
            x = act[a]; sub(/^ /, "", x)
            delete w2; nw = split(x, w2, " ")
            if (w2[1] == "ADD" && w2[2] == "CONSTRAINT") {
              y = x
              gsub(/ ON (DELETE|UPDATE) (SET NULL|SET DEFAULT|CASCADE|RESTRICT|NO ACTION)/, "", y)
              if (w2[4] != "FOREIGN" || w2[5] != "KEY" || y !~ / REFERENCES /) { err("the only constraint you may add to an existing table is a FOREIGN KEY", stmt); okall = 0; break }
              if (y ~ /(^| )(DROP|RENAME|ALTER|SET|RESET|TYPE|USING|NOT|CHECK|UNIQUE|PRIMARY|EXCLUDE|DEFAULT)( |$)/) { err("unexpected words in ADD CONSTRAINT ... FOREIGN KEY", stmt); okall = 0; break }
              continue
            }
            if (w2[1] == "ADD" && w2[2] == "COLUMN") {
              j = 3; if (w2[3] == "IF" && w2[4] == "NOT" && w2[5] == "EXISTS") j = 6
              if (w2[j] == "" ) { err("ADD COLUMN without a column", stmt); okall = 0; break }
              notnull = 0; hasdef = 0; defok = 1
              for (q = j + 1; q <= nw; q++) {
                if (w2[q] ~ /^(DROP|RENAME|ALTER|SET|RESET|USING|GENERATED|COLLATE|CHECK|REFERENCES|UNIQUE|PRIMARY|CONSTRAINT|ADD|AS|IDENTITY|STORED)$/) { defok = -1 }
                if (w2[q] == "NOT" && w2[q + 1] == "NULL") notnull = 1
                if (w2[q] == "DEFAULT") { hasdef = 1; if (!isconst(w2[q + 1])) defok = 0 }
              }
              if (defok == -1) { err("ADD COLUMN may only give a type, NULL/NOT NULL and a constant DEFAULT", stmt); okall = 0; break }
              if (!defok) { err("a column DEFAULT must be a constant (string, number, TRUE/FALSE/NULL or CURRENT_TIMESTAMP)", stmt); okall = 0; break }
              if (notnull && !hasdef) { err("a new NOT NULL column needs a DEFAULT (or make it optional)", stmt); okall = 0; break }
              continue
            }
            err("ALTER TABLE may only ADD COLUMN or ADD CONSTRAINT ... FOREIGN KEY", stmt); okall = 0; break
          }
          continue
        }
        err("only CREATE TABLE/INDEX/TYPE ... AS ENUM/SEQUENCE, ALTER TABLE ... ADD and ALTER TYPE ... ADD VALUE are allowed", stmt)
      }
      exit bad
    }'
}

case "${1:-}" in
  --against)
    ref=${2:?usage: check-migrations.sh --against <git-ref>}
    top=$(git rev-parse --show-toplevel) || exit 2
    cd "$top" || exit 2
    base=$(git merge-base "$ref" HEAD) || { echo "can't find merge-base with $ref" >&2; exit 2; }
    tab=$(printf '\t'); bad=0; found=0
    tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
    # Tracked changes since the branch point (working tree included), plus brand-new untracked files.
    git diff --name-status --no-renames "$base" -- prisma/migrations > "$tmp"
    git ls-files --others --exclude-standard -- prisma/migrations | sed "s/^/A$tab/" >> "$tmp"
    while IFS="$tab" read -r status path; do
      case "$path" in
        prisma/migrations/migration_lock.toml) continue ;;
      esac
      # Only plain prisma/migrations/<14 digits>_<lowercase_name>/migration.sql files.
      # Anything else (odd names, quoted paths, symlinks, extra files) is refused.
      if ! printf '%s\n' "$path" | grep -Eq '^prisma/migrations/[0-9]{14}_[a-z0-9_]+/migration\.sql$' || [ -L "$path" ]; then
        echo "$path: unexpected file in prisma/migrations (only <timestamp>_<name>/migration.sql)" >&2; bad=1; continue
      fi
      found=1
      if [ "$status" = "A" ]; then
        check_sql "$path" < "$path" || bad=1
      else
        echo "$path: migrations already on $ref must never be edited or deleted (git status: $status)" >&2; bad=1
      fi
    done < "$tmp"
    if [ "$bad" -eq 0 ]; then
      [ "$found" -eq 1 ] && echo "migrations OK: additive only" || echo "no migration changes"
    fi
    exit "$bad"
    ;;
  -)
    check_sql "${2:-stdin}"; exit $?
    ;;
  ""|-h|--help)
    sed -n '2,35p' "$0" >&2; exit 2
    ;;
  *)
    bad=0
    for f in "$@"; do check_sql "$f" < "$f" || bad=1; done
    exit "$bad"
    ;;
esac
