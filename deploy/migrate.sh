#!/usr/bin/env bash
# GUSTO · aplica migrações pendentes (roda no container "migrate", como superusuário do banco) · by m3d.pro
set -Eeuo pipefail
log(){ printf '[migrate] %s\n' "$*"; }
pq(){ psql -v ON_ERROR_STOP=1 -qtA "$@"; }
for i in $(seq 60); do pg_isready -q && break; sleep 1; done

# Papel de aplicação com privilégio mínimo (sem DDL, sem acesso a schema_migrations).
[[ "$GUSTO_DB_PASSWORD" =~ ^[A-Za-z0-9._~-]{16,}$ ]] || { log "GUSTO_DB_PASSWORD deve ter 16+ caracteres [A-Za-z0-9._~-]"; exit 1; }
if [[ -z "$(pq -c "select 1 from pg_roles where rolname='gusto'")" ]]; then pq -c "create role gusto login password '$GUSTO_DB_PASSWORD'"
else pq -c "alter role gusto password '$GUSTO_DB_PASSWORD'"; fi
pq -c "create table if not exists schema_migrations(name text primary key, applied_at timestamptz default now())"

Q="'"; ROOTPW="${GUSTO_ROOT_PASSWORD:-}"; ESC="${ROOTPW//$Q/$Q$Q}"
for f in /migrations/*.sql; do
  n="$(basename "$f")"
  [[ -n "$(pq -c "select 1 from schema_migrations where name='$n'")" ]] && continue
  if [[ "$n" == 001_* && ${#ROOTPW} -lt 8 ]]; then log "primeira instalação: defina GUSTO_ROOT_PASSWORD (8+ caracteres)"; exit 1; fi
  log "aplicando $n"
  { printf "SET app.root_initial_password = '%s';\n" "$ESC"; cat "$f"; printf "\nINSERT INTO schema_migrations(name) VALUES ('%s');\n" "$n"; } \
    | psql -v ON_ERROR_STOP=1 -q -1 -f -
done
pq -c "grant usage on schema public to gusto; grant select,insert,update,delete on all tables in schema public to gusto; grant usage,select on all sequences in schema public to gusto; grant execute on all functions in schema public to gusto; revoke all on schema_migrations from gusto"
log "ok ($(pq -c 'select count(*) from schema_migrations') migrações aplicadas)"
