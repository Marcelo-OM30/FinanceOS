#!/usr/bin/env bash
#
# Backup do Postgres de produção do FinanceOS (Railway).
#
# Uso:
#   ./scripts/backup-db.sh              # backup normal
#   ./scripts/backup-db.sh --check      # só testa a conexão, não grava nada
#
# Variáveis opcionais:
#   FINANCEOS_BACKUP_DIR   destino (padrão: ~/backups/financeos)
#   FINANCEOS_BACKUP_KEEP  quantos manter (padrão: 14)
#   DATABASE_PUBLIC_URL    pula a consulta ao Railway e usa esta URL
#
# Requisitos: pg_dump/pg_restore (postgresql-client), railway CLI logado, python3.

set -euo pipefail

PROJECT_ID="c36e00ec-56ea-4eb8-9485-a6356e44556a"
ENVIRONMENT="production"
SERVICE="Postgres"

DEST="${FINANCEOS_BACKUP_DIR:-$HOME/backups/financeos}"
KEEP="${FINANCEOS_BACKUP_KEEP:-14}"
CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true

log()  { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { printf '%s  ERRO: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; exit 1; }

for bin in pg_dump pg_restore python3; do
  command -v "$bin" >/dev/null 2>&1 || fail "$bin não encontrado. Instale: sudo apt install postgresql-client"
done

# ── 1. Descobrir a URL de conexão ────────────────────────────────────────────
# É preciso a URL PÚBLICA (proxy.rlwy.net). A DATABASE_URL interna aponta para
# postgres.railway.internal, que só resolve dentro da rede do Railway — de fora
# ela falha com "could not translate host name".
if [[ -n "${DATABASE_PUBLIC_URL:-}" ]]; then
  DB_URL="$DATABASE_PUBLIC_URL"
  log "usando DATABASE_PUBLIC_URL do ambiente"
else
  command -v railway >/dev/null 2>&1 || fail "railway CLI não encontrado e DATABASE_PUBLIC_URL não definida"
  log "consultando a URL pública no Railway..."
  DB_URL="$(
    railway variables --service "$SERVICE" --project "$PROJECT_ID" \
                      --environment "$ENVIRONMENT" --json 2>/dev/null \
    | python3 -c 'import json,sys
try:
    v = json.load(sys.stdin)
except Exception:
    sys.exit(1)
for k in ("DATABASE_PUBLIC_URL", "POSTGRES_PUBLIC_URL"):
    if v.get(k):
        print(v[k]); break
'
  )" || true
  [[ -n "$DB_URL" ]] || fail "não consegui obter DATABASE_PUBLIC_URL do Railway (o serviço Postgres está no ar?)"
fi

# A partir daqui a URL é secreta: nunca ecoar. Mascara host para o log.
HOST_MASC="$(printf '%s' "$DB_URL" | sed -E 's#^.*@([^:/]+).*$#\1#')"
log "alvo: $HOST_MASC"

# ── 2. Testar a conexão e comparar versões ───────────────────────────────────
SERVER_VER="$(psql "$DB_URL" -tAc 'SHOW server_version;' 2>/dev/null | cut -d. -f1)" \
  || fail "não consegui conectar. Postgres está no ar? Há proxy TCP público habilitado?"
CLIENT_VER="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
log "servidor Postgres $SERVER_VER, pg_dump $CLIENT_VER"

if (( SERVER_VER > CLIENT_VER )); then
  fail "pg_dump ($CLIENT_VER) é mais antigo que o servidor ($SERVER_VER) e vai se recusar a rodar.
       Instale o cliente correspondente:
         sudo sh -c 'echo \"deb https://apt.postgresql.org/pub/repos/apt \$(lsb_release -cs)-pgdg main\" > /etc/apt/sources.list.d/pgdg.list'
         curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg
         sudo apt update && sudo apt install postgresql-client-$SERVER_VER"
fi

if $CHECK_ONLY; then
  log "conexão OK — nada foi gravado (--check)"
  exit 0
fi

# ── 3. Dump ──────────────────────────────────────────────────────────────────
mkdir -p "$DEST"
STAMP="$(date '+%Y%m%d-%H%M%S')"
OUT="$DEST/financeos-$STAMP.dump"

log "gerando dump em $OUT"
# -Fc = formato custom: comprimido, e restaurável seletivamente com pg_restore.
pg_dump --format=custom --no-owner --no-privileges --file="$OUT" "$DB_URL" \
  || { rm -f "$OUT"; fail "pg_dump falhou"; }

# ── 4. Verificar que o dump presta ───────────────────────────────────────────
# Um arquivo criado não é um backup: só é backup se der para ler de volta.
TABELAS="$(pg_restore --list "$OUT" 2>/dev/null | grep -c 'TABLE DATA' || true)"
[[ "$TABELAS" -gt 0 ]] || { rm -f "$OUT"; fail "dump gerado mas ilegível ou vazio — descartado"; }

TAMANHO="$(du -h "$OUT" | cut -f1)"
log "OK: $TAMANHO, $TABELAS tabelas com dados"

# ── 5. Rotação ───────────────────────────────────────────────────────────────
mapfile -t ANTIGOS < <(ls -1t "$DEST"/financeos-*.dump 2>/dev/null | tail -n +$((KEEP + 1)))
if (( ${#ANTIGOS[@]} > 0 )); then
  log "removendo ${#ANTIGOS[@]} backup(s) além dos $KEEP mais recentes"
  printf '%s\0' "${ANTIGOS[@]}" | xargs -0 rm -f
fi

log "concluído — $(ls -1 "$DEST"/financeos-*.dump 2>/dev/null | wc -l) backup(s) em $DEST"
