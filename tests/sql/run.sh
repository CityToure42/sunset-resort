#!/usr/bin/env bash
# 이 파일이 하는 일: 임시 PostgreSQL을 띄워 Supabase처럼 anon 역할을 만들고, 서버 SQL을 실행한 뒤 규칙 테스트를 돌리고 정리한다
set -euo pipefail
# PostgreSQL은 root로 실행할 수 없어서, root면 일반 사용자로 다시 실행한다
if [ "$(id -u)" = "0" ]; then exec runuser -u "${SR_PG_USER:-claude}" -- bash "$0" "$@"; fi
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN=/usr/lib/postgresql/16/bin
DATA="$(mktemp -d)/pg-sr"
PORT=55432
export PGHOST=/tmp PGPORT=$PORT PGUSER=postgres PGOPTIONS="-c client_min_messages=warning"
cleanup() { "$BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$(dirname "$DATA")"; }
trap cleanup EXIT

"$BIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null  # Supabase와 같은 UTF-8 (글자 수를 바이트가 아닌 글자로 셈)
"$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create role anon nologin; create role authenticated nologin;"
psql -q -v ON_ERROR_STOP=1 -d postgres -f "$ROOT/supabase/migrations/001_b_stage.sql"
# 두 번 실행해도 안전한지(재실행 가능) 확인
psql -q -v ON_ERROR_STOP=1 -d postgres -f "$ROOT/supabase/migrations/001_b_stage.sql"
psql -q -v ON_ERROR_STOP=1 -d postgres -f "$ROOT/tests/sql/b_stage_test.sql"
echo "SQL TESTS PASSED"
